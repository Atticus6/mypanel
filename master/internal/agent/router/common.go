package router

func commonGroups() []CommonRouter {
	return []CommonRouter{
		&DashboardRouter{},
		&HostRouter{},
		&ContainerRouter{},
		&LogRouter{},
		&FileRouter{},
		&CronjobRouter{},
		&BackupRouter{},
		&SettingRouter{},
		&AppRouter{},
		&WebsiteRouter{},
		&WebsiteDnsAccountRouter{},
		&WebsiteAcmeAccountRouter{},
		&WebsiteSSLRouter{},
		&NginxRouter{},
		&ProcessRouter{},
		&WebsiteCARouter{},
		&GroupRouter{},
		&AlertRouter{},
		&RuntimeDiagnosticsRouter{},
	}
}
