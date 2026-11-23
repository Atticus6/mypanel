package app

import (
	"mypanel/agent/utils/docker"
)

func Init() {
	go func() {
		_ = docker.CreateDefaultDockerNetwork()
	}()
}
