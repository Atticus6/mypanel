//go:build !xpack && !enterprise

package xpack

import (
	"github.com/gin-gonic/gin"
	"mypanel/agent/utils/xpack/helper"
)

var AlertProvider = helper.NewIAlertProvider()

var MultiNodeProvider = helper.NewIMultiNodeProvider()

func VMCountLimit(_ *gin.Context) int {
	return 1
}
