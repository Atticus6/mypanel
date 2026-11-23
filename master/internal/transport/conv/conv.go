// Package conv 在 1Panel 的 DTO 与 proto 消息之间做结构转换。
//
// 迁移期两边字段名几乎一一对应（DTO 的 json tag 与 proto 的 JSON 名称都是
// lowerCamelCase），因此读接口用 protojson 直接映射，避免为每个字段手写赋值。
// 写接口则反向把 proto 消息序列化成 JSON 再解进 DTO，借助同一套 tag 复用
// DTO 上已有的校验逻辑。
package conv

import (
	"encoding/json"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

// FromDTO 把 DTO 的 JSON 形态写入 proto 消息。
//
// proto 消息只声明前端需要的字段，DTO 中多出来的字段会被丢弃，
// 因此消息可以随页面需求逐步补齐而不影响已有调用。
func FromDTO(dto any, msg proto.Message) error {
	raw, err := json.Marshal(dto)
	if err != nil {
		return err
	}
	return protojson.UnmarshalOptions{DiscardUnknown: true}.Unmarshal(raw, msg)
}

// ToJSON 把 proto 消息序列化成 JSON，并保证字段名是 lowerCamelCase，
// 这样可以直接反序列化进 DTO。
func ToJSON(msg proto.Message) ([]byte, error) {
	return protojson.MarshalOptions{
		UseProtoNames:   false,
		EmitUnpopulated: true,
	}.Marshal(msg)
}
