package service

import (
	"mypanel/agent/constant"
	"mypanel/agent/utils/taskscope"
)

func ConfigurePanelMCPTasks() error {
	return taskscope.Configure(taskscope.Rule{Scope: constant.TaskScopePanelMCP, Restricted: true, ExternalExecutor: true})
}
