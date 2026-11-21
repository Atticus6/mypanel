//go:build wireinject
// +build wireinject

// wireinject 构建标签让这个文件只在运行 wire 时参与编译，
// 正常构建不会包含它（否则会和生成的 wire_gen.go 冲突）。

package app

import (
	"github.com/google/wire"
)

// InitApp 是 wire 的注入点。
//
// 函数体永远 panic：真正实现由 wire 生成到 wire_gen.go。
// 依赖链：Config → panel.Service → http.Handler → *http.Server → App。
func InitApp(cfg Config) (*App, error) {
	wire.Build(ProviderSet)
	return nil, nil
}
