# ================================================
# LifeBit AWS Terraform Outputs
# ================================================

# 기본 인프라 정보
output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_id" {
  description = "Public subnet ID"
  value       = aws_subnet.public.id
}

# 서버 정보
output "server_id" {
  description = "EC2 instance ID"
  value       = aws_instance.web.id
}

output "server_name" {
  description = "EC2 instance name"
  value       = aws_instance.web.tags["Name"]
}

output "public_ip" {
  description = "Public IP address (EIP)"
  value       = aws_eip.web.public_ip
}

output "private_ip" {
  description = "Private IP address"
  value       = aws_instance.web.private_ip
}

# SSH 키 정보
output "ssh_private_key" {
  description = "SSH private key for connection"
  value       = tls_private_key.lifebit.private_key_pem
  sensitive   = true
}

output "ssh_key_name" {
  description = "SSH key pair name"
  value       = aws_key_pair.lifebit.key_name
}

# 접속 정보
output "ssh_connection" {
  description = "SSH connection command"
  value       = "ssh -i ~/.ssh/lifebit.pem ubuntu@${aws_eip.web.public_ip}"
}

# 애플리케이션 접속 URLs
output "application_urls" {
  description = "Application access URLs"
  value = {
    frontend    = "http://${aws_eip.web.public_ip}:3000"
    spring_api  = "http://${aws_eip.web.public_ip}:8080"
    fastapi     = "http://${aws_eip.web.public_ip}:8001"
    airflow     = "http://${aws_eip.web.public_ip}:8081"
    grafana     = "http://${aws_eip.web.public_ip}:3001"
    prometheus  = "http://${aws_eip.web.public_ip}:9090"
    nginx_proxy = "http://${aws_eip.web.public_ip}:8082"
  }
}

# 보안 정보
output "security_group_id" {
  description = "Security Group ID"
  value       = aws_security_group.web.id
}

# 배포 가이드
output "deployment_guide" {
  description = "Quick deployment guide"
  value       = <<-EOT
🚀 LifeBit AWS 배포 완료!

📋 접속 정보:
- 서버 IP: ${aws_eip.web.public_ip}
- SSH 접속: ssh -i ~/.ssh/lifebit.pem ubuntu@${aws_eip.web.public_ip}

🔑 SSH 키 저장:
- 키 파일을 ~/.ssh/lifebit.pem에 저장하고 chmod 600 설정

🌐 애플리케이션 URLs:
- Frontend:     http://${aws_eip.web.public_ip}:3000
- Spring API:   http://${aws_eip.web.public_ip}:8080
- FastAPI:      http://${aws_eip.web.public_ip}:8001
- Nginx Proxy:  http://${aws_eip.web.public_ip}:8082
- Grafana:      http://${aws_eip.web.public_ip}:3001
- Prometheus:   http://${aws_eip.web.public_ip}:9090
- Airflow:      http://${aws_eip.web.public_ip}:8081

🔧 다음 단계:
1. SSH 키 파일 저장: terraform output -raw ssh_private_key > ~/.ssh/lifebit.pem && chmod 600 ~/.ssh/lifebit.pem
2. SSH로 서버 접속
3. Ansible 플레이북 실행: ansible-playbook -i inventory.ini playbook.yml
4. 애플리케이션 접속 확인

💰 예상 비용: 월 2-3만원 (t3.small 2GB RAM)
EOT
}

# 리소스 요약
output "resource_summary" {
  description = "Created resources summary"
  value = {
    vpc_id           = aws_vpc.main.id
    subnet_id        = aws_subnet.public.id
    instance_id      = aws_instance.web.id
    instance_type    = var.instance_type
    public_ip        = aws_eip.web.public_ip
    environment      = var.environment
    project_name     = var.project_name
    region           = var.aws_region
    availability_zone = var.aws_az
  }
} 