// Package webdist 存放编译进 master 二进制的 web 前端产物。
//
// dist 目录由 scripts/build.sh 从 web/dist 复制而来，内容不入库（只保留
// .gitkeep 占位）。保留占位文件是为了让 go:embed 指令在干净 checkout、
// 前端尚未构建时依然能编译通过。
package webdist

import "embed"

// FS 包含前端产物，根目录下应有 index.html。
//
// 使用 all: 前缀是为了把以 . 或 _ 开头的文件也一并嵌入。
//
//go:embed all:dist
var FS embed.FS
