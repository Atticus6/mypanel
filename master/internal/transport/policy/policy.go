// Package policy 从 proto 方法注解中读取鉴权、CSRF 与审计策略。
//
// 策略的唯一来源是 .proto 文件：新增接口时忘记标注，
// 会按「需要登录、需要 CSRF、需要审计」的保守默认值处理。
package policy

import (
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"

	commonv1 "mypanel/proto/gen/go/panel/common/v1"
)

// Method 是一个 RPC 方法的访问策略。
type Method struct {
	// Public 表示允许未登录访问。
	Public bool
	// CSRFExempt 表示跳过 CSRF 校验。
	CSRFExempt bool
	// NoAudit 表示不写操作日志。
	NoAudit bool
	// ReadOnly 表示只读方法，演示模式下仍然放行。
	ReadOnly bool
	// AuditActionZH 是审计日志里的中文动作名。
	AuditActionZH string
	// AuditActionEN 是审计日志里的英文动作名。
	AuditActionEN string
}

// Registry 按完整 procedure 名索引方法策略。
type Registry map[string]Method

// Default 返回未标注方法时的保守策略。
func Default() Method {
	return Method{}
}

// ForService 读取一个 proto service 下所有方法的策略。
//
// key 使用 Connect/gRPC 的完整 procedure 名（/package.Service/Method），
// 与传入 connect.Request.Spec().Procedure 一致，拦截器不需要再做字符串拼接。
func ForService(service protoreflect.ServiceDescriptor) Registry {
	registry := Registry{}
	methods := service.Methods()
	for i := 0; i < methods.Len(); i++ {
		method := methods.Get(i)
		procedure := "/" + string(service.FullName()) + "/" + string(method.Name())
		registry[procedure] = read(method.Options())
	}
	return registry
}

// Merge 把另一个注册表合并进来，重复的 procedure 后者覆盖前者。
func (r Registry) Merge(other Registry) Registry {
	for key, value := range other {
		r[key] = value
	}
	return r
}

// Lookup 返回指定 procedure 的策略；未登记时返回保守默认值。
func (r Registry) Lookup(procedure string) Method {
	if r == nil {
		return Default()
	}
	if method, ok := r[procedure]; ok {
		return method
	}
	return Default()
}

// read 从方法选项中取出 MethodPolicy 扩展。
func read(options protoreflect.ProtoMessage) Method {
	if options == nil {
		return Default()
	}
	message, ok := options.(proto.Message)
	if !ok {
		return Default()
	}
	value := proto.GetExtension(message, commonv1.E_Policy)
	policy, ok := value.(*commonv1.MethodPolicy)
	if !ok || policy == nil {
		return Default()
	}
	return Method{
		Public:        policy.GetPublic(),
		CSRFExempt:    policy.GetCsrfExempt(),
		NoAudit:       policy.GetNoAudit(),
		ReadOnly:      policy.GetReadOnly(),
		AuditActionZH: policy.GetAuditActionZh(),
		AuditActionEN: policy.GetAuditActionEn(),
	}
}
