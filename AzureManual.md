Congratulations. You have successfully run a Node-RED instance in the Azure Australia East region.

To make it easier to reuse later or hand over to team members, this document summarizes the setup as a quick reference guide.

---

## 📘 Node-RED on Azure Deployment Manual

### Phase 1: Initialize the Environment

Before starting, make sure the subscription has the required resource providers enabled.

1. **Register the container service** (run once only):

   ```bash
   az provider register --namespace Microsoft.ContainerInstance
   ```

2. **Create a resource group** (to manage resources together):

   ```bash
   az group create --name NodeRedGroupAU --location australiaeast
   ```

### Phase 2: Deploy the Container

This is the core command that successfully runs your current Node-RED instance. It specifies CPU, memory, public IP, and a unique DNS label.

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

- **Access URL**: `http://zhangsu1305.australiaeast.azurecontainer.io:1880`

---

## 🛠 Daily Container Management Commands

After deployment, these commands are the most useful for managing the environment.

### 1. Check status and get the address

If you forget the URL or want to confirm whether it is running:

```bash
az container show --resource-group NodeRedGroupAU --name nodered-instance --query "{FQDN:ipAddress.fqdn,State:instanceView.state}" --output table
```

### 2. Stop the container

If you are not using the workflow for a while, stopping it can reduce unnecessary cost:

```bash
az container stop --name nodered-instance --resource-group NodeRedGroupAU
```

### 3. Start the container again

```bash
az container start --name nodered-instance --resource-group NodeRedGroupAU
```

### 4. View runtime logs

If a Node-RED node reports an error, you can inspect the backend container logs directly:

```bash
az container logs --name nodered-instance --resource-group NodeRedGroupAU
```

### 5. Delete everything

If you want to rebuild the lab from scratch or no longer need this environment:

```bash
az group delete --name NodeRedGroupAU --yes --no-wait
```

---

## ⚠️ Important Next Steps

Although the service is already running, there are still two important issues to consider.

1. **Data persistence**

   The current deployment is stateless. This means that **if you delete the container, your flows may also be lost**.

   - Recommendation: learn how to mount an **Azure Files** volume to the `/data` path.

2. **Security**

   The current Node-RED instance is publicly accessible without authentication.

   - Recommendation: enable authentication in the Node-RED settings menu, or use the `NODE_RED_CREDENTIAL_SECRET` environment variable for better protection.

---

## 🗄 Azure SQL Database Initialization Commands

If you want to store processed email results from Node-RED in Azure SQL Database, you can initialize the database environment with the following steps.

### Phase 3: Register the SQL resource provider

```bash
az provider register --namespace Microsoft.Sql
```

### Phase 4: Prepare variables

```bash
RG="NodeRedGroupAU"
LOC="australiaeast"
SERVER="comp9033sqlsu01"
DB="supportemaildb"
ADMIN_USER="sqladminsu"
ADMIN_PASS='<your-secure-password>'
```

### Phase 5: Create the SQL Server

```bash
az sql server create \
  --name $SERVER \
  --resource-group $RG \
  --location $LOC \
  --admin-user $ADMIN_USER \
  --admin-password $ADMIN_PASS
```

### Phase 6: Allow Azure service access

```bash
az sql server firewall-rule create \
  --resource-group $RG \
  --server $SERVER \
  -n AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

This rule allows Azure internal services to access the SQL Server, which is useful when Node-RED or other Azure services need to connect to the database later.

### Phase 7: Create the database

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

### Phase 8: Recommended follow-up steps

After creation, it is recommended to continue with the following actions:

1. Record the database connection details:
   - server name
   - database name
   - admin username
2. Confirm in Azure Portal that the database status is `Online`
3. Create application tables such as `support_emails` in SQL Query Editor or a local SQL client
4. Configure the connection details in the Node-RED database node

### ⚠️ Security Note

This manual currently shows the administrator password as a placeholder so the deployment steps can be repeated safely.

If you plan to share this document with teammates or upload it to a repository, keep the password masked like this:

```bash
ADMIN_PASS='<your-secure-password>'
```
