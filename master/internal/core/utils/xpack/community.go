//go:build !xpack && !enterprise

package xpack

import (
	"github.com/gin-gonic/gin"
	"mypanel/core/utils/xpack/helper"
)

var AuthProvider = helper.NewIAuthProvider()

var MultiNodeProvider = helper.NewIMultiNodeProvider()

func IsMasterProductPro() bool {
	return false
}

func VMCountLimit(_ *gin.Context) int {
	return 1
}
