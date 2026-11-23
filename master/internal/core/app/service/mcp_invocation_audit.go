package service

import (
	"time"

	"mypanel/core/app/model"
	"mypanel/core/app/repo"
)

func (s *MCPService) finishInvocationAudit(record model.MCPInvocation) error {
	var err error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt) * 50 * time.Millisecond)
		}
		err = (repo.MCPRepo{DB: s.DB}).UpdateRunningInvocation(record)
		if err == nil {
			return nil
		}
	}
	return err
}

func (s *MCPService) RecoverInterruptedInvocations(processStartedAt time.Time) error {
	now := s.Now()
	return (repo.MCPRepo{DB: s.DB}).UpdateInterruptedInvocations(processStartedAt, "failed", "MCP_OUTCOME_UNKNOWN", now)
}
