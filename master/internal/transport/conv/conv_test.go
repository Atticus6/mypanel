package conv

import (
	"encoding/json"
	"testing"

	corev1 "mypanel/proto/gen/go/panel/core/v1"
)

// TestFromDTODropsUnknownFields 验证 DTO 中未声明的字段被丢弃，其余字段正常映射。
func TestFromDTODropsUnknownFields(t *testing.T) {
	dto := struct {
		PanelName     string `json:"panelName"`
		SystemVersion string `json:"systemVersion"`
		UnknownField  string `json:"unknownField"`
	}{
		PanelName:     "mypanel",
		SystemVersion: "v2.5.1",
		UnknownField:  "ignored",
	}

	msg := &corev1.SettingBaseInfo{}
	if err := FromDTO(dto, msg); err != nil {
		t.Fatalf("FromDTO: %v", err)
	}
	if msg.GetPanelName() != "mypanel" {
		t.Fatalf("panel_name = %q, 期望 mypanel", msg.GetPanelName())
	}
	if msg.GetSystemVersion() != "v2.5.1" {
		t.Fatalf("system_version = %q, 期望 v2.5.1", msg.GetSystemVersion())
	}
}

// TestToJSONUsesCamelCase 验证序列化后的键名可直接反序列化进 DTO（lowerCamelCase）。
func TestToJSONUsesCamelCase(t *testing.T) {
	raw, err := ToJSON(&corev1.SettingBaseInfo{PanelName: "mypanel"})
	if err != nil {
		t.Fatalf("ToJSON: %v", err)
	}
	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("反序列化失败: %v", err)
	}
	if decoded["panelName"] != "mypanel" {
		t.Fatalf("panelName = %v, 期望 mypanel", decoded["panelName"])
	}
	if _, ok := decoded["panel_name"]; ok {
		t.Fatal("不应出现 snake_case 键名")
	}
}
