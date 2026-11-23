package agent

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/filestream"
	"mypanel/master/internal/transport/errmap"
)

// fileTickets 是进程内共享的票据存储。
var fileTickets = filestream.NewStore()

// FileHandlers 返回 /files/upload 与 /files/download 的 HTTP 处理器。
//
// 它们与 FileTransferService 共用同一个票据存储，所以必须由同一处创建。
func FileHandlers() (upload http.Handler, download http.Handler) {
	return fileTickets.UploadHandler(), fileTickets.DownloadHandler()
}

// FileTransferServer 实现 panel.agent.v1.FileTransferService。
type FileTransferServer struct{}

// NewFileTransferServer 构造文件传输票据服务。
func NewFileTransferServer() *FileTransferServer {
	return &FileTransferServer{}
}

// CreateUploadTicket 签发上传票据。
func (s *FileTransferServer) CreateUploadTicket(
	_ context.Context,
	req *connect.Request[agentv1.CreateUploadTicketRequest],
) (*connect.Response[agentv1.FileTicket], error) {
	filename := strings.TrimSpace(req.Msg.GetFilename())
	if filename == "" || filename == "." || filename == ".." || filepath.Base(filename) != filename {
		return nil, errmap.FromMsgKey("ErrInvalidParams", nil)
	}
	target := filepath.Join(req.Msg.GetDir(), filename)
	token, expires, err := fileTickets.Issue(filestream.Ticket{
		Purpose:   filestream.PurposeUpload,
		Path:      target,
		Filename:  filename,
		Size:      req.Msg.GetSize(),
		Overwrite: req.Msg.GetOverwrite(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	return connect.NewResponse(&agentv1.FileTicket{
		Token:     token,
		Url:       "/files/upload",
		ExpiresAt: expires.Format("2006-01-02T15:04:05Z07:00"),
	}), nil
}

// CreateDownloadTicket 签发下载票据。
func (s *FileTransferServer) CreateDownloadTicket(
	_ context.Context,
	req *connect.Request[agentv1.CreateDownloadTicketRequest],
) (*connect.Response[agentv1.FileTicket], error) {
	path := string(req.Msg.GetPath())
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return nil, errmap.FromMsgKey("ErrRecordNotFound", err)
	}
	token, expires, err := fileTickets.Issue(filestream.Ticket{
		Purpose:  filestream.PurposeDownload,
		Path:     path,
		Filename: info.Name(),
		Size:     info.Size(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	return connect.NewResponse(&agentv1.FileTicket{
		Token:     token,
		Url:       "/files/download",
		ExpiresAt: expires.Format("2006-01-02T15:04:05Z07:00"),
	}), nil
}
