package transport_test

import (
	"testing"

	"google.golang.org/protobuf/proto"
	commonv1 "mypanel/proto/gen/go/panel/common/v1"

	"mypanel/master/internal/transport"
)

// TestEveryRegisteredMethodHasPolicy 是 RPC 覆盖率门禁的一部分：
// 每个已注册的方法都必须显式声明策略注解，避免新增接口忘记鉴权/CSRF/审计。
func TestEveryRegisteredMethodHasPolicy(t *testing.T) {
	descriptors := transport.ServiceDescriptors()
	if len(descriptors) == 0 {
		t.Fatal("没有登记任何 proto service")
	}

	for _, service := range descriptors {
		methods := service.Methods()
		for i := 0; i < methods.Len(); i++ {
			method := methods.Get(i)
			procedure := "/" + string(service.FullName()) + "/" + string(method.Name())
			options := method.Options()
			if options == nil {
				t.Fatalf("%s 缺少策略注解", procedure)
			}
			value := proto.GetExtension(options, commonv1.E_Policy)
			if _, ok := value.(*commonv1.MethodPolicy); !ok {
				t.Fatalf("%s 的 policy 扩展类型不正确: %T", procedure, value)
			}
		}
	}
}

// TestEveryDescriptorIsRegistered 防止描述符清单与 handler 注册表漂移。
func TestEveryDescriptorIsRegistered(t *testing.T) {
	services := transport.Services()
	descriptors := transport.ServiceDescriptors()
	if len(services) != len(descriptors) {
		t.Fatalf("services = %d, descriptors = %d，必须一一对应", len(services), len(descriptors))
	}

	registered := make(map[string]bool, len(services))
	for _, svc := range services {
		if svc.Name == "" || svc.Path == "" || svc.Handler == nil {
			t.Fatalf("服务注册不完整: %+v", svc)
		}
		registered[svc.Name] = true
	}
	for _, descriptor := range descriptors {
		if !registered[string(descriptor.FullName())] {
			t.Fatalf("%s 有描述符但没有注册 handler", descriptor.FullName())
		}
	}
}

// TestServiceNamesAreUnique 防止同名服务被重复挂载。
func TestServiceNamesAreUnique(t *testing.T) {
	seen := map[string]bool{}
	for _, svc := range transport.Services() {
		if seen[svc.Name] {
			t.Fatalf("服务重复注册: %s", svc.Name)
		}
		seen[svc.Name] = true
	}
}
