恭喜！你现在已经在 Azure 的悉尼数据中心成功运行了一个 Node-RED 实例。

为了方便你以后复用或者交给团队成员，我为你梳理了这份**《Azure Node-RED 部署与管理速查手册》**。

---

## 📘 Node-RED on Azure 部署手册

### 第一阶段：初始化环境
在开始之前，需要确保订阅已激活相关的资源提供商。

1.  **注册容器服务**（只需运行一次）：
    ```bash
    az provider register --namespace Microsoft.ContainerInstance
    ```
2.  **创建资源组**（将资源集中管理）：
    ```bash
    az group create --name NodeRedGroupAU --location australiaeast
    ```

### 第二阶段：部署容器
这是你目前运行成功的核心指令。我们指定了 CPU、内存、公网 IP 以及唯一的域名标签。

```bash
az container create \
  --resource-group NodeRedGroupAU \
  --name nodered-instance \
  --image nodered/node-red \
  --cpu 1 \
  --memory 1.5 \
  --port 1880 \
  --ip-address Public \
  --location australiaeast \
  --dns-name-label zhangsu1305 \
  --os-type Linux
```

* **访问地址**：`http://zhangsu1305.australiaeast.azurecontainer.io:1880`

---

## 🛠 容器日常管理指令

部署完成后，你会频繁用到以下指令来控制你的环境：

### 1. 查看状态与获取地址
如果你忘了访问地址或想看它是否在运行：
```bash
az container show --resource-group NodeRedGroupAU --name nodered-instance --query "{FQDN:ipAddress.fqdn,State:instanceView.state}" --output table
```

### 2. 停止容器（停止计费）
当你下班或暂时不需要运行 Flow 时，建议停止它以节省开支：
```bash
az container stop --name nodered-instance --resource-group NodeRedGroupAU
```

### 3. 重新启动
```bash
az container start --name nodered-instance --resource-group NodeRedGroupAU
```

### 4. 查看运行日志
如果 Node-RED 里的某个节点报错，你可以直接看容器的后台日志：
```bash
az container logs --name nodered-instance --resource-group NodeRedGroupAU
```

### 5. 彻底删除（清理环境）
如果你想从头再来或不再需要此实验：
```bash
az group delete --name NodeRedGroupAU --yes --no-wait
```

---

## ⚠️ 重要进阶提示 (Next Steps)

虽然你现在已经跑通了，但作为**初创团队的 R&D 管理者**，有两点你必须注意：

1.  **数据持久化（防丢失）**：
    目前的部署方式是“无状态”的。这意味着**如果你删除容器，你写的 Flow 也会一起消失**。
    * *建议*：后续学习如何挂载 **Azure Files** 卷到 `/data` 路径。

2.  **安全防护**：
    目前的 Node-RED 默认是公网直接访问且无密码的。
    * *建议*：尽快在 Node-RED 界面右侧菜单设置身份验证，或者通过环境变量 `NODE_RED_CREDENTIAL_SECRET` 加密。

---

## 🗄 Azure SQL Database 初始化指令

如果你要把 Node-RED 处理后的邮件结果写入 Azure SQL Database，可以按下面步骤初始化数据库环境。

### 第三阶段：注册 SQL 资源提供商

```bash
az provider register --namespace Microsoft.Sql
```

### 第四阶段：准备变量

```bash
RG="NodeRedGroupAU"
LOC="australiaeast"
SERVER="comp9033sqlsu01"
DB="supportemaildb"
ADMIN_USER="sqladminsu"
ADMIN_PASS='<your-secure-password>'
```

### 第五阶段：创建 SQL Server

```bash
az sql server create \
  --name $SERVER \
  --resource-group $RG \
  --location $LOC \
  --admin-user $ADMIN_USER \
  --admin-password $ADMIN_PASS
```

### 第六阶段：开放 Azure 服务访问规则

```bash
az sql server firewall-rule create \
  --resource-group $RG \
  --server $SERVER \
  -n AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

这个规则的作用是允许 Azure 内部服务访问你的 SQL Server，方便后续云端 Node-RED 或其他 Azure 服务接入数据库。

### 第七阶段：创建数据库

```bash
az sql db create \
  --resource-group $RG \
  --server $SERVER \
  --name $DB \
  --edition GeneralPurpose \
  --compute-model Serverless \
  --family Gen5 \
  --capacity 2
```

### 第八阶段：后续建议

创建完成后，建议继续做以下事情：

1. 记录数据库连接信息：
   - server name
   - database name
   - admin username
2. 在 Azure Portal 中确认数据库状态是否为 `Online`
3. 在 SQL Query Editor 或本地 SQL 客户端中创建业务表，例如 `support_emails`
4. 把连接信息配置到 Node-RED 的数据库节点中

