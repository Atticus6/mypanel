// Package config 负责加载 master 的运行配置。
//
// 配置来源与优先级（高到低，与 viper 的查找顺序一致）：
//  1. 命令行参数（flag）——显式指定，覆盖一切
//  2. 环境变量（前缀 MYPANEL_，下划线命名）
//  3. YAML 配置文件
//  4. 内置默认值
//
// 也就是说环境变量总是能覆盖配置文件，便于在容器里做临时调整，
// 而不必修改镜像内的 YAML。
package config

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/viper"
)

// EnvPrefix 是所有环境变量的统一前缀。
//
// 加前缀是为了避免和宿主机上其它程序的变量（如 PORT、DEBUG）冲突——
// 那些变量很常见，不加前缀会静默影响本服务的行为。
const EnvPrefix = "MYPANEL"

// DefaultConfigName 是未显式指定路径时查找的配置文件名（不含扩展名）。
const DefaultConfigName = "config"

// LocalConfigName 是可选的本地覆盖文件（不含扩展名）。
//
// 找到主配置后，如果同目录存在 config.local.yaml 就再叠一层：
// 适合放本机的端口调整、调试开关，不污染入库的 config.yaml。
const LocalConfigName = "config.local"

// DefaultConfigPaths 是未显式指定路径时的搜索目录，按顺序查找。
//
// 同时包含当前目录与 ./config：前者适合容器内单文件部署，
// 后者适合仓库里把配置和代码分开存放。
var DefaultConfigPaths = []string{".", "./config", "/etc/mypanel"}

// Config 是 master 的完整运行配置。
type Config struct {
	// Addr 是 HTTP 监听地址，对应 addr / MYPANEL_ADDR。
	Addr string
	// WebDir 是前端产物目录；为空表示用编译进二进制的版本，
	// 对应 web_dir / MYPANEL_WEB_DIR。
	WebDir string
	// Debug 打开 gin 调试模式，对应 debug / MYPANEL_DEBUG。
	Debug bool
	// ShutdownTimeout 是优雅退出的最长等待时间，
	// 对应 shutdown_timeout / MYPANEL_SHUTDOWN_TIMEOUT。
	ShutdownTimeout time.Duration
	// ConfigFile 记录实际加载的配置文件路径，为空表示没加载文件。
	// 仅用于启动日志，便于排查「配置没生效」这类问题。
	ConfigFile string
}

// defaults 是各配置项的默认值。
//
// 单独列出便于测试与文档同步；新增配置项时三处都要改：
// 这个 map、Config 结构体、以及 AGENTS.md 的表格。
var defaults = map[string]any{
	"addr":             ":8080",
	"web_dir":          "",
	"debug":            false,
	"shutdown_timeout": "5s",
}

// Options 控制 Load 的行为。
type Options struct {
	// Path 是显式指定的配置文件路径。非空时必须存在，否则报错——
	// 用户明确指定了文件却读不到，静默回退到默认值会掩盖部署错误。
	Path string
	// SkipFile 跳过配置文件加载，只用环境变量与默认值。
	// 测试与「配置全部来自环境变量」的部署可以打开。
	SkipFile bool
}

// Load 按优先级加载配置。
//
// v 允许为 nil，此时新建一个；测试可以传入预配置好的 viper 实例
// （例如 Set 了值的实例）来避免依赖真实环境变量。
func Load(v *viper.Viper, opts Options) (Config, error) {
	if v == nil {
		v = newViper()
	}

	// 默认值先写入：viper 的 Get 在键不存在时返回零值，
	// 显式 SetDefault 能让「未配置」与「配成零值」区分开。
	for key, val := range defaults {
		v.SetDefault(key, val)
	}

	cfg := Config{}
	if !opts.SkipFile {
		loaded, err := loadFile(v, opts.Path)
		if err != nil {
			return Config{}, err
		}
		cfg.ConfigFile = loaded
	}

	cfg.Addr = v.GetString("addr")
	cfg.WebDir = v.GetString("web_dir")
	cfg.Debug = v.GetBool("debug")

	// 时长单独解析：viper 的 GetDuration 对非法值会静默返回 0，
	// 这里显式报错，避免「配错了却按 0 超时运行」这种隐蔽问题。
	// 用 GetString 而不是 GetDuration，因为 YAML 里 5s 是字符串、
	// 而 env 里也只会是字符串，统一按字符串解析最可控。
	rawTimeout := v.GetString("shutdown_timeout")
	timeout, err := time.ParseDuration(rawTimeout)
	if err != nil {
		return Config{}, fmt.Errorf("shutdown_timeout %q 不是合法的时长（示例：5s、1m）: %w", rawTimeout, err)
	}
	if timeout <= 0 {
		return Config{}, fmt.Errorf("shutdown_timeout 必须为正数，当前为 %s", timeout)
	}
	cfg.ShutdownTimeout = timeout

	if err := cfg.validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

// loadFile 加载 YAML 配置并返回实际路径。
//
// path 非空时按显式路径加载；为空时在 DefaultConfigPaths 下查找
// DefaultConfigName，找不到不算错误（配置文件是可选的）。
//
// 无论哪种情况，只要主配置所在目录存在 config.local.yaml，就再叠一层覆盖。
// 用 v.MergeInConfig 而不是 ReadInConfig：后者会整体替换已加载的配置，
// 前者只覆盖出现的键，未提及的键保持主配置的值。
func loadFile(v *viper.Viper, path string) (string, error) {
	if path != "" {
		v.SetConfigFile(path)
		// 显式指定时按扩展名推断类型；.yaml/.yml 之外也允许，
		// 但报错信息里会提示本服务预期 YAML。
		if err := v.ReadInConfig(); err != nil {
			return "", fmt.Errorf("读取配置文件 %s 失败: %w", path, err)
		}
		used := v.ConfigFileUsed()
		if err := mergeLocalOverride(v, filepath.Dir(used)); err != nil {
			return "", err
		}
		return used, nil
	}

	v.SetConfigName(DefaultConfigName)
	v.SetConfigType("yaml")
	for _, dir := range DefaultConfigPaths {
		v.AddConfigPath(dir)
	}

	if err := v.ReadInConfig(); err != nil {
		// 找不到配置文件是正常情况：默认值加环境变量足以运行。
		var notFound viper.ConfigFileNotFoundError
		if errors.As(err, &notFound) {
			return "", nil
		}
		// 文件存在但解析失败属于真错误，必须暴露出来，
		// 否则一个 YAML 缩进错误会让人误以为配置项没写对。
		var pathErr *fs.PathError
		if errors.As(err, &pathErr) && errors.Is(pathErr.Err, fs.ErrNotExist) {
			return "", nil
		}
		return "", fmt.Errorf("解析配置文件失败: %w", err)
	}

	used := v.ConfigFileUsed()
	if err := mergeLocalOverride(v, filepath.Dir(used)); err != nil {
		return "", err
	}
	return used, nil
}

// mergeLocalOverride 在 dir 下查找 config.local.yaml 并合并。
//
// 文件不存在时静默返回：本地覆盖是可选的。
// 存在但解析失败时报错，理由同上——静默忽略会让人以为覆盖生效了。
func mergeLocalOverride(v *viper.Viper, dir string) error {
	local := filepath.Join(dir, LocalConfigName+".yaml")
	if _, err := os.Stat(local); err != nil {
		return nil
	}

	// 用独立的 viper 读覆盖文件，避免影响主配置的搜索路径设置。
	overlay := viper.New()
	overlay.SetConfigFile(local)
	if err := overlay.ReadInConfig(); err != nil {
		return fmt.Errorf("读取本地覆盖配置 %s 失败: %w", local, err)
	}
	if err := v.MergeConfigMap(overlay.AllSettings()); err != nil {
		return fmt.Errorf("合并本地覆盖配置 %s 失败: %w", local, err)
	}
	return nil
}

// validate 检查配置项的合法性。
//
// 只做「明显错误」的校验，不猜测用户意图：例如不校验端口是否被占用，
// 那属于启动时才知道的事。
func (c Config) validate() error {
	if strings.TrimSpace(c.Addr) == "" {
		return fmt.Errorf("addr 不能为空")
	}
	if strings.TrimSpace(c.WebDir) != "" {
		if _, err := os.Stat(c.WebDir); err != nil {
			return fmt.Errorf("web_dir %q 不可用: %w", c.WebDir, err)
		}
	}
	return nil
}

// newViper 构造带环境变量支持的 viper 实例。
//
// 关键点：AutomaticEnv 只在「键未被显式设置」时生效，而键名默认不做任何
// 转换。所以必须同时设置 EnvKeyReplacer，把 config 里的下划线键名映射成
// 环境变量名，否则 MYPANEL_WEB_DIR 这类变量永远读不到。
func newViper() *viper.Viper {
	v := viper.New()
	v.SetEnvPrefix(EnvPrefix)
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_", "-", "_"))
	v.AutomaticEnv()
	return v
}

// NewViper 供测试与外部使用，返回一个已配置好环境变量映射的实例。
func NewViper() *viper.Viper { return newViper() }

// ResolvePath 把相对路径转成绝对路径，仅用于日志展示。
//
// 失败时原样返回：路径存在与否不影响「日志里能看到什么」这件事。
func ResolvePath(p string) string {
	if p == "" {
		return ""
	}
	abs, err := filepath.Abs(p)
	if err != nil {
		return p
	}
	return abs
}
