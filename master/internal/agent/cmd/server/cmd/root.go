package cmd

import (
	"github.com/spf13/cobra"
	"mypanel/agent/server"
)

var RootCmd = &cobra.Command{
	Use: "1panel-agent",
	RunE: func(cmd *cobra.Command, args []string) error {
		server.Start()
		return nil
	},
}
