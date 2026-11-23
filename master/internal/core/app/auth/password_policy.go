package auth

import (
	"errors"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"mypanel/core/app/repo"
	"mypanel/core/buserr"
	"mypanel/core/constant"
	"mypanel/core/utils/common"
)

type PasswordExpirationProvider interface {
	ShouldCheckPasswordExpiration(*gin.Context) (bool, error)
	LoadPasswordExpirationTime(*gin.Context) (string, error)
}

func IsPasswordExpired(c *gin.Context, provider PasswordExpirationProvider) (bool, error) {
	daysText, err := repo.NewISettingRepo().GetValueByKey("ExpirationDays")
	if err != nil {
		return false, err
	}
	days, err := strconv.Atoi(daysText)
	if err != nil || days < 0 {
		return false, errors.New("invalid password expiration policy")
	}
	if days == 0 {
		return false, nil
	}
	if provider == nil {
		return false, errors.New("password expiration provider unavailable")
	}
	check, err := provider.ShouldCheckPasswordExpiration(c)
	if err != nil || !check {
		return false, err
	}
	deadline, err := provider.LoadPasswordExpirationTime(c)
	if err != nil {
		return false, err
	}
	expiresAt, err := time.ParseInLocation(constant.DateTimeLayout, deadline, common.LoadExpiredLocation())
	if err != nil {
		return false, err
	}
	return !time.Now().Before(expiresAt), nil
}

func RequireUnexpiredPassword(c *gin.Context, provider PasswordExpirationProvider) error {
	expired, err := IsPasswordExpired(c, provider)
	if err != nil {
		return err
	}
	if expired {
		return buserr.New("ErrPasswordExpired")
	}
	return nil
}
