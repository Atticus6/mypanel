package agent

import (
	"context"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// ListTemplates 列出全部 Compose 模板。
func (s *ContainerServer) ListTemplates(
	_ context.Context,
	_ *connect.Request[agentv1.ListComposeTemplatesRequest],
) (*connect.Response[agentv1.ComposeTemplates], error) {
	list, err := s.template.List()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.ComposeTemplateInfo, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.ComposeTemplateInfo{
			Id:          uint32(item.ID),
			CreatedAt:   formatTime(item.CreatedAt),
			Name:        item.Name,
			Description: item.Description,
			Content:     item.Content,
		})
	}
	return connect.NewResponse(&agentv1.ComposeTemplates{Items: items}), nil
}

// CreateTemplate 创建 Compose 模板。
func (s *ContainerServer) CreateTemplate(
	_ context.Context,
	req *connect.Request[agentv1.CreateComposeTemplateRequest],
) (*connect.Response[agentv1.CreateComposeTemplateResponse], error) {
	if err := s.template.Create(agentdto.ComposeTemplateCreate{
		Name:        req.Msg.GetName(),
		Description: req.Msg.GetDescription(),
		Content:     req.Msg.GetContent(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateComposeTemplateResponse{}), nil
}

// UpdateTemplate 修改 Compose 模板。
func (s *ContainerServer) UpdateTemplate(
	_ context.Context,
	req *connect.Request[agentv1.UpdateComposeTemplateRequest],
) (*connect.Response[agentv1.UpdateComposeTemplateResponse], error) {
	// service 层用 map 更新，允许只改描述或只改内容。
	upMap := map[string]interface{}{
		"description": req.Msg.GetDescription(),
		"content":     req.Msg.GetContent(),
	}
	if err := s.template.Update(uint(req.Msg.GetId()), upMap); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateComposeTemplateResponse{}), nil
}

// DeleteTemplates 批量删除 Compose 模板。
func (s *ContainerServer) DeleteTemplates(
	_ context.Context,
	req *connect.Request[agentv1.DeleteComposeTemplatesRequest],
) (*connect.Response[agentv1.DeleteComposeTemplatesResponse], error) {
	ids := make([]uint, 0, len(req.Msg.GetIds()))
	for _, id := range req.Msg.GetIds() {
		ids = append(ids, uint(id))
	}
	if err := s.template.Delete(ids); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteComposeTemplatesResponse{}), nil
}

// BatchTemplates 批量导入 Compose 模板。
func (s *ContainerServer) BatchTemplates(
	_ context.Context,
	req *connect.Request[agentv1.BatchComposeTemplatesRequest],
) (*connect.Response[agentv1.BatchComposeTemplatesResponse], error) {
	templates := make([]agentdto.ComposeTemplateCreate, 0, len(req.Msg.GetTemplates()))
	for _, item := range req.Msg.GetTemplates() {
		templates = append(templates, agentdto.ComposeTemplateCreate{
			Name:        item.GetName(),
			Description: item.GetDescription(),
			Content:     item.GetContent(),
		})
	}
	if err := s.template.Batch(agentdto.ComposeTemplateBatch{Templates: templates}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.BatchComposeTemplatesResponse{}), nil
}

// ListRepos 列出镜像仓库（选项视图）。
func (s *ContainerServer) ListRepos(
	_ context.Context,
	_ *connect.Request[agentv1.ListImageReposRequest],
) (*connect.Response[agentv1.ImageRepoOptions], error) {
	list, err := s.repo.List()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.ImageRepoOption, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.ImageRepoOption{Id: uint32(item.ID), Name: item.Name})
	}
	return connect.NewResponse(&agentv1.ImageRepoOptions{Items: items}), nil
}

// CreateRepo 创建镜像仓库。
func (s *ContainerServer) CreateRepo(
	_ context.Context,
	req *connect.Request[agentv1.CreateImageRepoRequest],
) (*connect.Response[agentv1.CreateImageRepoResponse], error) {
	if err := s.repo.Create(agentdto.ImageRepoCreate{
		Name:        req.Msg.GetName(),
		DownloadUrl: req.Msg.GetDownloadUrl(),
		Protocol:    req.Msg.GetProtocol(),
		Username:    req.Msg.GetUsername(),
		Password:    req.Msg.GetPassword(),
		Auth:        req.Msg.GetAuth(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateImageRepoResponse{}), nil
}

// UpdateRepo 修改镜像仓库。
func (s *ContainerServer) UpdateRepo(
	_ context.Context,
	req *connect.Request[agentv1.UpdateImageRepoRequest],
) (*connect.Response[agentv1.UpdateImageRepoResponse], error) {
	if err := s.repo.Update(agentdto.ImageRepoUpdate{
		ID:          uint(req.Msg.GetId()),
		DownloadUrl: req.Msg.GetDownloadUrl(),
		Protocol:    req.Msg.GetProtocol(),
		Username:    req.Msg.GetUsername(),
		Password:    req.Msg.GetPassword(),
		Auth:        req.Msg.GetAuth(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateImageRepoResponse{}), nil
}

// DeleteRepo 删除镜像仓库。
func (s *ContainerServer) DeleteRepo(
	_ context.Context,
	req *connect.Request[agentv1.DeleteImageRepoRequest],
) (*connect.Response[agentv1.DeleteImageRepoResponse], error) {
	if err := s.repo.Delete(agentdto.OperateByID{ID: uint(req.Msg.GetId())}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteImageRepoResponse{}), nil
}

// CheckRepoStatus 检查仓库连通性（执行登录）。
func (s *ContainerServer) CheckRepoStatus(
	_ context.Context,
	req *connect.Request[agentv1.CheckImageRepoStatusRequest],
) (*connect.Response[agentv1.CheckImageRepoStatusResponse], error) {
	if err := s.repo.Login(agentdto.OperateByID{ID: uint(req.Msg.GetId())}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CheckImageRepoStatusResponse{}), nil
}
