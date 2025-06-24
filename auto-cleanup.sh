#!/bin/bash
set -e

# 스크립트 정보
SCRIPT_NAME=$(basename "$0")
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# LifeBit 프로젝트 정보
PROJECT_NAME="${PROJECT_NAME:-LifeBit}"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 로깅 함수
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_cleanup() { echo -e "${PURPLE}[CLEANUP]${NC} $1"; }

# .env 파일 로드 (LifeBit 프로젝트 루트)
load_env() {
    local env_file="$SCRIPT_DIR/.env"
    if [[ -f "$env_file" ]]; then
        log_info "LifeBit .env 파일 로드 중..."
        source "$env_file"
        log_success ".env 파일 로드 완료"
    else
        log_warning ".env 파일을 찾을 수 없습니다: $env_file"
        log_info "기본 환경 변수를 사용합니다."
    fi
}

# Slack 알림 전송
send_slack_notification() {
    local message="$1"
    local webhook_url="$SLACK_WEBHOOK_URL"
    
    if [[ -z "$webhook_url" ]]; then
        return 0  # 웹훅이 없어도 오류로 처리하지 않음
    fi
    
    local payload=$(cat << EOF
{
    "text": "$message",
    "username": "LifeBit Cleanup Bot",
    "icon_emoji": ":recycle:"
}
EOF
)
    
    curl -X POST -H 'Content-type: application/json' \
        --data "$payload" "$webhook_url" > /dev/null 2>&1 || true
}

# Discord 알림 전송
send_discord_notification() {
    local message="$1"
    local webhook_url="$DISCORD_WEBHOOK_URL"
    
    if [[ -z "$webhook_url" ]]; then
        return 0  # 웹훅이 없어도 오류로 처리하지 않음
    fi
    
    local payload=$(cat << EOF
{
    "embeds": [{
        "title": "🍃 LifeBit 정리 알림",
        "description": "$message",
        "color": 3447003,
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
        "footer": {
            "text": "LifeBit Auto Cleanup"
        }
    }]
}
EOF
)
    
    curl -X POST -H 'Content-type: application/json' \
        --data "$payload" "$webhook_url" > /dev/null 2>&1 || true
}

# 통합 알림 전송
send_notification() {
    local message="$1"
    local level="${2:-info}"
    
    # 색상 설정
    case "$level" in
        "success") color="3447003" ;;  # 파란색
        "error") color="15158332" ;;   # 빨간색
        "warning") color="16776960" ;; # 노란색
        *) color="15158332" ;;         # 기본 빨간색 (정리 작업)
    esac
    
    # Slack 알림
    send_slack_notification "$message"
    
    # Discord 알림 (임베드 형식)
    local discord_message="$message"
    local webhook_url="$DISCORD_WEBHOOK_URL"
    
    if [[ -n "$webhook_url" ]]; then
        local payload=$(cat << EOF
{
    "embeds": [{
        "title": "🍃 LifeBit 정리 알림",
        "description": "$discord_message",
        "color": $color,
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
        "footer": {
            "text": "LifeBit Auto Cleanup"
        }
    }]
}
EOF
)
        
        curl -X POST -H 'Content-type: application/json' \
            --data "$payload" "$webhook_url" > /dev/null 2>&1 || true
    fi
}

# LifeBit Docker Compose 정리
cleanup_docker_compose() {
    log_cleanup "LifeBit Docker Compose 정리 중..."
    
    if [[ -f "$COMPOSE_FILE" ]]; then
        log_info "Docker Compose 서비스 중지 중..."
        cd "$SCRIPT_DIR" && docker-compose down -v --remove-orphans 2>/dev/null || true
        
        log_info "Docker Compose 이미지 삭제 중..."
        cd "$SCRIPT_DIR" && docker-compose down --rmi all 2>/dev/null || true
        
        log_success "Docker Compose 정리 완료"
    else
        log_warning "docker-compose.yml 파일을 찾을 수 없습니다"
    fi
}

# LifeBit Docker 이미지 및 컨테이너 정리
cleanup_lifebit_docker() {
    log_cleanup "LifeBit Docker 리소스 정리 중..."
    
    # LifeBit 관련 컨테이너 중지 및 삭제
    local containers=$(docker ps -aq --filter "name=lifebit" --filter "name=fastapi" --filter "name=spring" --filter "name=frontend" --filter "name=airflow" --filter "name=postgres" 2>/dev/null || true)
    
    if [[ -n "$containers" ]]; then
        log_info "LifeBit 컨테이너 중지 및 삭제 중..."
        docker stop $containers 2>/dev/null || true
        docker rm $containers 2>/dev/null || true
        log_success "LifeBit 컨테이너 정리 완료"
    else
        log_info "정리할 LifeBit 컨테이너가 없습니다"
    fi
    
    # LifeBit 관련 이미지 삭제
    local images=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "(lifebit|fastapi|spring|frontend|airflow)" 2>/dev/null || true)
    
    if [[ -n "$images" ]]; then
        log_info "LifeBit Docker 이미지 삭제 중..."
        echo "$images" | while read -r image; do
            if [[ -n "$image" && "$image" != "<none>:<none>" ]]; then
                log_info "이미지 삭제: $image"
                docker rmi "$image" 2>/dev/null || true
            fi
        done
        log_success "LifeBit Docker 이미지 정리 완료"
    else
        log_info "정리할 LifeBit Docker 이미지가 없습니다"
    fi
    
    # Dangling 이미지 정리
    local dangling=$(docker images -f "dangling=true" -q 2>/dev/null || true)
    if [[ -n "$dangling" ]]; then
        log_info "Dangling 이미지 삭제 중..."
        docker rmi $dangling 2>/dev/null || true
        log_success "Dangling 이미지 정리 완료"
    fi
    
    # LifeBit 네트워크 정리
    local networks=$(docker network ls --filter "name=lifebit" --format "{{.Name}}" 2>/dev/null || true)
    if [[ -n "$networks" ]]; then
        log_info "LifeBit 네트워크 삭제 중..."
        echo "$networks" | while read -r network; do
            if [[ -n "$network" ]]; then
                docker network rm "$network" 2>/dev/null || true
            fi
        done
        log_success "LifeBit 네트워크 정리 완료"
    fi
    
    # LifeBit 볼륨 정리
    local volumes=$(docker volume ls --filter "name=lifebit" --format "{{.Name}}" 2>/dev/null || true)
    if [[ -n "$volumes" ]]; then
        log_info "LifeBit 볼륨 삭제 중..."
        echo "$volumes" | while read -r volume; do
            if [[ -n "$volume" ]]; then
                docker volume rm "$volume" 2>/dev/null || true
            fi
        done
        log_success "LifeBit 볼륨 정리 완료"
    fi
}

# LifeBit 로컬 파일 정리
cleanup_local_files() {
    log_cleanup "LifeBit 로컬 파일 정리 중..."
    
    # 임시 파일들 정리
    local temp_files=(
        "$SCRIPT_DIR/logs/*.log"
        "$SCRIPT_DIR/apps/*/logs/*.log"
        "$SCRIPT_DIR/apps/airflow-pipeline/logs/*"
        "$SCRIPT_DIR/*.tmp"
        "$SCRIPT_DIR/.DS_Store"
        "$SCRIPT_DIR/*/.DS_Store"
    )
    
    for pattern in "${temp_files[@]}"; do
        if ls $pattern 1> /dev/null 2>&1; then
            log_info "임시 파일 삭제: $pattern"
            rm -rf $pattern 2>/dev/null || true
        fi
    done
    
    # Maven/Gradle 빌드 아티팩트 정리
    if [[ -d "$SCRIPT_DIR/apps/core-api-spring/target" ]]; then
        log_info "Spring Boot 빌드 아티팩트 삭제 중..."
        rm -rf "$SCRIPT_DIR/apps/core-api-spring/target" 2>/dev/null || true
        log_success "Spring Boot 빌드 아티팩트 정리 완료"
    fi
    
    # Node.js 빌드 아티팩트 정리 (선택적)
    if [[ "$CLEAN_NODE_MODULES" == "true" ]]; then
        local node_dirs=(
            "$SCRIPT_DIR/apps/frontend-vite/node_modules"
            "$SCRIPT_DIR/node_modules"
            "$SCRIPT_DIR/packages/shared-types/node_modules"
        )
        
        for dir in "${node_dirs[@]}"; do
            if [[ -d "$dir" ]]; then
                log_info "Node.js 모듈 삭제: $dir"
                rm -rf "$dir" 2>/dev/null || true
            fi
        done
        log_success "Node.js 모듈 정리 완료"
    fi
    
    log_success "로컬 파일 정리 완료"
}

# 정리 시작 알림
notify_cleanup_start() {
    local project_name="$1"
    local resource_type="$2"
    
    local message="🧹 **LifeBit 리소스 정리 시작!**\n\n📦 **프로젝트:** $project_name\n🗑️ **정리 대상:** $resource_type\n⏰ **시간:** $(date '+%Y-%m-%d %H:%M:%S')\n🌍 **환경:** ${ENVIRONMENT:-개발}"
    
    send_notification "$message" "warning"
    log_info "정리 시작 알림 전송 완료"
}

# 정리 단계 알림
notify_cleanup_step() {
    local step="$1"
    local status="$2"
    local details="$3"
    
    local emoji=""
    case "$status" in
        "success") emoji="✅" ;;
        "error") emoji="❌" ;;
        "warning") emoji="⚠️" ;;
        *) emoji="🗑️" ;;
    esac
    
    local message="$emoji **$step**\n\n$details\n⏰ **시간:** $(date '+%Y-%m-%d %H:%M:%S')"
    
    send_notification "$message" "$status"
    log_info "정리 단계 알림 전송 완료: $step"
}

# 정리 완료 알림
notify_cleanup_success() {
    local project_name="$1"
    local resource_type="$2"
    local deleted_count="$3"
    
    local message="🎉 **LifeBit 리소스 정리 완료!**\n\n📦 **프로젝트:** $project_name\n🗑️ **정리 대상:** $resource_type\n📊 **삭제된 리소스:** $deleted_count\n⏰ **시간:** $(date '+%Y-%m-%d %H:%M:%S')\n💡 **상태:** 정리 성공"
    
    send_notification "$message" "success"
    log_success "정리 완료 알림 전송 완료"
}

# 정리 실패 알림
notify_cleanup_failure() {
    local project_name="$1"
    local error_message="$2"
    
    local message="💥 **LifeBit 리소스 정리 실패!**\n\n📦 **프로젝트:** $project_name\n❌ **오류:** $error_message\n⏰ **시간:** $(date '+%Y-%m-%d %H:%M:%S')\n🛠️ **조치:** 수동 확인 필요"
    
    send_notification "$message" "error"
    log_error "정리 실패 알림 전송 완료"
}

# 필수 환경 변수 확인
check_required_vars() {
    # NCP 키 변수명 호환성 처리
    if [[ -n "$NCP_ACCESS_KEY" ]]; then
        export ACCESS_KEY="$NCP_ACCESS_KEY"
    fi
    if [[ -n "$NCP_SECRET_KEY" ]]; then
        export SECRET_KEY="$NCP_SECRET_KEY"
    fi
    
    local required_vars=("ACCESS_KEY" "SECRET_KEY")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_warning "일부 환경 변수가 누락되었습니다: ${missing_vars[*]}"
        log_info "누락된 변수가 있어도 로컬 Docker 정리는 계속 진행됩니다."
        return 1
    fi
    
    return 0
}

# 네이버클라우드 CLI 확인
check_cli() {
    if [[ ! -f "$HOME/.ncloud/ncloud" ]]; then
        log_warning "네이버클라우드 CLI가 설치되지 않았습니다"
        log_info "로컬 Docker 정리만 수행됩니다."
        return 1
    fi
    
    export PATH="$HOME/.ncloud:$PATH"
    export NCLOUD_CLI_HOME="$HOME/.ncloud"
    return 0
}

# CLI 설정 (환경변수 방식)
configure_cli() {
    log_info "CLI 설정 확인 중..."
    
    # 환경변수로 CLI 설정
    export NCLOUD_ACCESS_KEY_ID="$ACCESS_KEY"
    export NCLOUD_SECRET_ACCESS_KEY="$SECRET_KEY"
    export NCLOUD_API_URL="https://ncloud.apigw.ntruss.com"
    
    log_info "Access Key: ${ACCESS_KEY:0:10}..."
    log_info "Secret Key: ${SECRET_KEY:0:10}..."
    
    # CLI 테스트
    if (cd "$HOME/.ncloud" && ./ncloud help > /dev/null 2>&1); then
        log_success "CLI 설정 확인 완료"
        return 0
    else
        log_warning "CLI 설정 실패"
        return 1
    fi
}

# 서버 인스턴스 삭제
delete_server_instances() {
    log_info "서버 인스턴스 삭제 중..."
    local server_list=$(cd "$HOME/.ncloud" && ./ncloud vserver getServerInstanceList --output json 2>&1)
    
    # Forbidden 오류 처리
    if [[ "$server_list" == *"Forbidden"* ]]; then
        log_warning "서버 목록 조회 권한이 없습니다. 네이버 클라우드 콘솔에서 수동으로 확인해주세요."
        return 0
    fi
    
    # JSON 유효성 확인
    if ! echo "$server_list" | jq empty 2>/dev/null; then
        log_warning "서버 목록 조회 실패 또는 빈 응답"
        return 0
    fi
    
    local server_count=$(echo "$server_list" | jq '.getServerInstanceListResponse.serverInstanceList | length // 0')
    
    if [[ "$server_count" -gt 0 ]]; then
        echo "$server_list" | jq -r '.getServerInstanceListResponse.serverInstanceList[] | .serverInstanceNo' | while read -r server_no; do
            if [[ -n "$server_no" ]]; then
                log_info "서버 중지 중: $server_no"
                cd "$HOME/.ncloud" && ./ncloud vserver stopServerInstances --serverInstanceNoList "$server_no" 2>/dev/null || true
                
                # 서버 중지 대기
                sleep 30
                
                log_info "서버 삭제 중: $server_no"
                cd "$HOME/.ncloud" && ./ncloud vserver terminateServerInstances --serverInstanceNoList "$server_no" 2>/dev/null || true
                
                log_success "서버 삭제 완료: $server_no"
            fi
        done
    else
        log_info "삭제할 서버가 없습니다"
    fi
}

# 퍼블릭 IP 삭제
delete_public_ips() {
    log_info "퍼블릭 IP 삭제 중..."
    local ip_list=$(cd "$HOME/.ncloud" && ./ncloud vserver getPublicIpInstanceList --output json 2>&1)
    
    # Forbidden 오류 처리
    if [[ "$ip_list" == *"Forbidden"* ]]; then
        log_warning "퍼블릭 IP 목록 조회 권한이 없습니다."
        return 0
    fi
    
    # JSON 유효성 확인
    if ! echo "$ip_list" | jq empty 2>/dev/null; then
        log_warning "퍼블릭 IP 목록 조회 실패 또는 빈 응답"
        return 0
    fi
    
    local ip_count=$(echo "$ip_list" | jq '.getPublicIpInstanceListResponse.publicIpInstanceList | length // 0')
    
    if [[ "$ip_count" -gt 0 ]]; then
        echo "$ip_list" | jq -r '.getPublicIpInstanceListResponse.publicIpInstanceList[] | .publicIpInstanceNo' | while read -r ip_no; do
            if [[ -n "$ip_no" ]]; then
                log_info "퍼블릭 IP 삭제 중: $ip_no"
                cd "$HOME/.ncloud" && ./ncloud vserver deletePublicIpInstance --publicIpInstanceNo "$ip_no" 2>/dev/null || true
                log_success "퍼블릭 IP 삭제 완료: $ip_no"
            fi
        done
    else
        log_info "삭제할 퍼블릭 IP가 없습니다"
    fi
}

# ACG 삭제
delete_acgs() {
    log_info "ACG 삭제 중..."
    local acg_list=$(cd "$HOME/.ncloud" && ./ncloud vserver getAccessControlGroupList --output json 2>&1)
    
    # Forbidden 오류 처리
    if [[ "$acg_list" == *"Forbidden"* ]]; then
        log_warning "ACG 목록 조회 권한이 없습니다."
        return 0
    fi
    
    # JSON 유효성 확인
    if ! echo "$acg_list" | jq empty 2>/dev/null; then
        log_warning "ACG 목록 조회 실패 또는 빈 응답"
        return 0
    fi
    
    local acg_count=$(echo "$acg_list" | jq -r '.getAccessControlGroupListResponse.accessControlGroupList | length // 0')
    
    if [[ "$acg_count" -gt 0 ]]; then
        echo "$acg_list" | jq -r '.getAccessControlGroupListResponse.accessControlGroupList[] | select(.isDefault == false) | .accessControlGroupNo + " " + (.vpcNo // "")' | while read -r acg_no vpc_no; do
            if [[ -n "$acg_no" && -n "$vpc_no" ]]; then
                log_info "ACG 삭제 중: $acg_no (VPC: $vpc_no)"
                cd "$HOME/.ncloud" && ./ncloud vserver deleteAccessControlGroup --accessControlGroupNo "$acg_no" --vpcNo "$vpc_no" 2>/dev/null || true
                log_success "ACG 삭제 완료: $acg_no"
            fi
        done
    else
        log_info "삭제할 ACG가 없습니다"
    fi
}

# 서브넷 삭제
delete_subnets() {
    log_info "서브넷 삭제 중..."
    local subnet_list=$(cd "$HOME/.ncloud" && ./ncloud vpc getSubnetList --output json 2>&1)
    
    # Forbidden 오류 처리
    if [[ "$subnet_list" == *"Forbidden"* ]]; then
        log_warning "서브넷 목록 조회 권한이 없습니다."
        return 0
    fi
    
    # JSON 유효성 확인
    if ! echo "$subnet_list" | jq empty 2>/dev/null; then
        log_warning "서브넷 목록 조회 실패 또는 빈 응답"
        return 0
    fi
    
    local subnet_count=$(echo "$subnet_list" | jq '.getSubnetListResponse.subnetList | length // 0')
    
    if [[ "$subnet_count" -gt 0 ]]; then
        echo "$subnet_list" | jq -r '.getSubnetListResponse.subnetList[] | .subnetNo' | while read -r subnet_no; do
            if [[ -n "$subnet_no" ]]; then
                log_info "서브넷 삭제 중: $subnet_no"
                cd "$HOME/.ncloud" && ./ncloud vpc deleteSubnet --subnetNo "$subnet_no" 2>/dev/null || true
                log_success "서브넷 삭제 완료: $subnet_no"
            fi
        done
    else
        log_info "삭제할 서브넷이 없습니다"
    fi
}

# 로드밸런서 삭제
delete_load_balancers() {
    log_info "로드밸런서 삭제 중..."
    local lb_list=$(cd "$HOME/.ncloud" && ./ncloud vloadbalancer getLoadBalancerInstanceList --output json 2>&1)
    
    # Forbidden 오류 처리
    if [[ "$lb_list" == *"Forbidden"* ]]; then
        log_warning "로드밸런서 목록 조회 권한이 없습니다."
        return 0
    fi
    
    # JSON 유효성 확인
    if ! echo "$lb_list" | jq empty 2>/dev/null; then
        log_warning "로드밸런서 목록 조회 실패 또는 빈 응답"
        return 0
    fi
    
    local lb_count=$(echo "$lb_list" | jq '.getLoadBalancerInstanceListResponse.loadBalancerInstanceList | length // 0')
    
    if [[ "$lb_count" -gt 0 ]]; then
        echo "$lb_list" | jq -r '.getLoadBalancerInstanceListResponse.loadBalancerInstanceList[] | .loadBalancerInstanceNo' | while read -r lb_no; do
            if [[ -n "$lb_no" ]]; then
                log_info "로드밸런서 삭제 중: $lb_no"
                cd "$HOME/.ncloud" && ./ncloud vloadbalancer deleteLoadBalancerInstances --loadBalancerInstanceNoList "$lb_no" 2>/dev/null || true
                log_success "로드밸런서 삭제 완료: $lb_no"
            fi
        done
    else
        log_info "삭제할 로드밸런서가 없습니다"
    fi
}

# NAT Gateway 삭제
delete_nat_gateways() {
    log_info "NAT Gateway 삭제 중..."
    local nat_list=$(cd "$HOME/.ncloud" && ./ncloud vpc getNatGatewayInstanceList --output json 2>&1)
    
    # Forbidden 오류 처리
    if [[ "$nat_list" == *"Forbidden"* ]]; then
        log_warning "NAT Gateway 목록 조회 권한이 없습니다."
        return 0
    fi
    
    # JSON 유효성 확인
    if ! echo "$nat_list" | jq empty 2>/dev/null; then
        log_warning "NAT Gateway 목록 조회 실패 또는 빈 응답"
        return 0
    fi
    
    local nat_count=$(echo "$nat_list" | jq '.getNatGatewayInstanceListResponse.natGatewayInstanceList | length // 0')
    
    if [[ "$nat_count" -gt 0 ]]; then
        echo "$nat_list" | jq -r '.getNatGatewayInstanceListResponse.natGatewayInstanceList[] | .natGatewayInstanceNo' | while read -r nat_no; do
            if [[ -n "$nat_no" ]]; then
                log_info "NAT Gateway 삭제 중: $nat_no"
                cd "$HOME/.ncloud" && ./ncloud vpc deleteNatGatewayInstance --natGatewayInstanceNo "$nat_no" 2>/dev/null || true
                log_success "NAT Gateway 삭제 완료: $nat_no"
            fi
        done
    else
        log_info "삭제할 NAT Gateway가 없습니다"
    fi
}

# 네트워크 인터페이스 삭제
delete_network_interfaces() {
    log_info "네트워크 인터페이스 삭제 중..."
    local ni_list=$(cd "$HOME/.ncloud" && ./ncloud vserver getNetworkInterfaceList --output json 2>&1)
    
    # Forbidden 오류 처리
    if [[ "$ni_list" == *"Forbidden"* ]]; then
        log_warning "네트워크 인터페이스 목록 조회 권한이 없습니다."
        return 0
    fi
    
    # JSON 유효성 확인
    if ! echo "$ni_list" | jq empty 2>/dev/null; then
        log_warning "네트워크 인터페이스 목록 조회 실패 또는 빈 응답"
        return 0
    fi
    
    local ni_count=$(echo "$ni_list" | jq '.getNetworkInterfaceListResponse.networkInterfaceList | length // 0')
    
    if [[ "$ni_count" -gt 0 ]]; then
        echo "$ni_list" | jq -r '.getNetworkInterfaceListResponse.networkInterfaceList[] | select(.isPrimary == false) | .networkInterfaceNo' | while read -r ni_no; do
            if [[ -n "$ni_no" ]]; then
                log_info "네트워크 인터페이스 삭제 중: $ni_no"
                cd "$HOME/.ncloud" && ./ncloud vserver deleteNetworkInterface --networkInterfaceNo "$ni_no" 2>/dev/null || true
                log_success "네트워크 인터페이스 삭제 완료: $ni_no"
            fi
        done
    else
        log_info "삭제할 네트워크 인터페이스가 없습니다"
    fi
}

# Route Table 삭제
delete_route_tables() {
    log_info "Route Table 삭제 중..."
    local rt_list=$(cd "$HOME/.ncloud" && ./ncloud vpc getRouteTableList --output json 2>&1)
    
    # Forbidden 오류 처리
    if [[ "$rt_list" == *"Forbidden"* ]]; then
        log_warning "Route Table 목록 조회 권한이 없습니다."
        return 0
    fi
    
    # JSON 유효성 확인
    if ! echo "$rt_list" | jq empty 2>/dev/null; then
        log_warning "Route Table 목록 조회 실패 또는 빈 응답"
        return 0
    fi
    
    local rt_count=$(echo "$rt_list" | jq '.getRouteTableListResponse.routeTableList | length // 0')
    
    if [[ "$rt_count" -gt 0 ]]; then
        echo "$rt_list" | jq -r '.getRouteTableListResponse.routeTableList[] | select(.isDefault == false) | .routeTableNo' | while read -r rt_no; do
            if [[ -n "$rt_no" ]]; then
                log_info "Route Table 삭제 중: $rt_no"
                cd "$HOME/.ncloud" && ./ncloud vpc deleteRouteTable --routeTableNo "$rt_no" 2>/dev/null || true
                log_success "Route Table 삭제 완료: $rt_no"
            fi
        done
    else
        log_info "삭제할 Route Table이 없습니다"
    fi
}

# Internet Gateway 삭제
delete_internet_gateways() {
    log_info "Internet Gateway 삭제 중..."
    local igw_list=$(cd "$HOME/.ncloud" && ./ncloud vpc getInternetGatewayInstanceList --output json 2>&1)
    
    # Forbidden 오류 처리
    if [[ "$igw_list" == *"Forbidden"* ]]; then
        log_warning "Internet Gateway 목록 조회 권한이 없습니다."
        return 0
    fi
    
    # JSON 유효성 확인
    if ! echo "$igw_list" | jq empty 2>/dev/null; then
        log_warning "Internet Gateway 목록 조회 실패 또는 빈 응답"
        return 0
    fi
    
    local igw_count=$(echo "$igw_list" | jq '.getInternetGatewayInstanceListResponse.internetGatewayInstanceList | length // 0')
    
    if [[ "$igw_count" -gt 0 ]]; then
        echo "$igw_list" | jq -r '.getInternetGatewayInstanceListResponse.internetGatewayInstanceList[] | .internetGatewayInstanceNo' | while read -r igw_no; do
            if [[ -n "$igw_no" ]]; then
                log_info "Internet Gateway 삭제 중: $igw_no"
                cd "$HOME/.ncloud" && ./ncloud vpc deleteInternetGatewayInstance --internetGatewayInstanceNo "$igw_no" 2>/dev/null || true
                log_success "Internet Gateway 삭제 완료: $igw_no"
            fi
        done
    else
        log_info "삭제할 Internet Gateway가 없습니다"
    fi
}

# VPC 삭제
delete_vpcs() {
    log_info "VPC 삭제 중..."
    local vpc_list=$(cd "$HOME/.ncloud" && ./ncloud vpc getVpcList --output json 2>&1)
    
    # Forbidden 오류 처리
    if [[ "$vpc_list" == *"Forbidden"* ]]; then
        log_warning "VPC 목록 조회 권한이 없습니다."
        return 0
    fi
    
    # JSON 유효성 확인
    if ! echo "$vpc_list" | jq empty 2>/dev/null; then
        log_warning "VPC 목록 조회 실패 또는 빈 응답"
        return 0
    fi
    
    local vpc_count=$(echo "$vpc_list" | jq '.getVpcListResponse.vpcList | length // 0')
    
    if [[ "$vpc_count" -gt 0 ]]; then
        echo "$vpc_list" | jq -r '.getVpcListResponse.vpcList[] | select(.isDefault == false) | .vpcNo' | while read -r vpc_no; do
            if [[ -n "$vpc_no" ]]; then
                log_info "VPC 삭제 중: $vpc_no"
                cd "$HOME/.ncloud" && ./ncloud vpc deleteVpc --vpcNo "$vpc_no" 2>/dev/null || true
                log_success "VPC 삭제 완료: $vpc_no"
            fi
        done
    else
        log_info "삭제할 VPC가 없습니다"
    fi
}

# LifeBit 전체 정리 (로컬 + 클라우드)
cleanup_all() {
    log_cleanup "LifeBit 전체 리소스 정리 시작..."
    
    local total_deleted=0
    
    # 1. Docker Compose 정리
    cleanup_docker_compose
    total_deleted=$((total_deleted + 1))
    
    # 2. LifeBit Docker 리소스 정리
    cleanup_lifebit_docker
    total_deleted=$((total_deleted + 5))
    
    # 3. 로컬 파일 정리
    cleanup_local_files
    total_deleted=$((total_deleted + 3))
    
    # 4. 네이버클라우드 리소스 정리 (CLI가 설정된 경우)
    if check_required_vars && check_cli && configure_cli; then
        log_info "네이버클라우드 리소스 정리를 시작합니다."
        
        # 1. 서버 인스턴스 삭제 (가장 먼저)
        delete_server_instances
        total_deleted=$((total_deleted + 2))
        
        # 잠시 대기 (서버 삭제 완료 대기)
        log_info "서버 삭제 완료 대기 중... (60초)"
        sleep 60
        
        # 2. 로드밸런서 삭제
        delete_load_balancers
        total_deleted=$((total_deleted + 1))
        
        # 3. NAT Gateway 삭제
        delete_nat_gateways
        total_deleted=$((total_deleted + 1))
        
        # 4. 퍼블릭 IP 삭제
        delete_public_ips
        total_deleted=$((total_deleted + 1))
        
        # 5. 네트워크 인터페이스 삭제
        delete_network_interfaces
        total_deleted=$((total_deleted + 1))
        
        # 6. ACG 삭제 (기본 ACG 제외)
        delete_acgs
        total_deleted=$((total_deleted + 1))
        
        # 7. 서브넷 삭제
        delete_subnets
        total_deleted=$((total_deleted + 1))
        
        # 8. Route Table 삭제
        delete_route_tables
        total_deleted=$((total_deleted + 1))
        
        # 9. Internet Gateway 삭제
        delete_internet_gateways
        total_deleted=$((total_deleted + 1))
        
        # 10. VPC 삭제 (마지막)
        delete_vpcs
        total_deleted=$((total_deleted + 1))
        
        log_success "네이버클라우드 리소스 정리 완료"
    else
        log_info "네이버클라우드 CLI 설정이 없어 로컬 정리만 수행됩니다."
    fi
    
    log_success "LifeBit 전체 리소스 정리 완료 (총 $total_deleted개 항목)"
}

# 특정 리소스만 삭제 (LifeBit용으로 개선)
cleanup_specific() {
    local resource_type="$1"
    
    case "$resource_type" in
        "docker")
            cleanup_lifebit_docker
            ;;
        "compose")
            cleanup_docker_compose
            ;;
        "local")
            cleanup_local_files
            ;;
        "servers")
            if check_required_vars && check_cli && configure_cli; then
                delete_server_instances
            else
                log_error "네이버클라우드 CLI 설정이 필요합니다."
                exit 1
            fi
            ;;
        "ips")
            if check_required_vars && check_cli && configure_cli; then
                delete_public_ips
            else
                log_error "네이버클라우드 CLI 설정이 필요합니다."
                exit 1
            fi
            ;;
        "acgs")
            if check_required_vars && check_cli && configure_cli; then
                delete_acgs
            else
                log_error "네이버클라우드 CLI 설정이 필요합니다."
                exit 1
            fi
            ;;
        "subnets")
            if check_required_vars && check_cli && configure_cli; then
                delete_subnets
            else
                log_error "네이버클라우드 CLI 설정이 필요합니다."
                exit 1
            fi
            ;;
        "vpcs")
            if check_required_vars && check_cli && configure_cli; then
                delete_vpcs
            else
                log_error "네이버클라우드 CLI 설정이 필요합니다."
                exit 1
            fi
            ;;
        "loadbalancers"|"lbs")
            if check_required_vars && check_cli && configure_cli; then
                delete_load_balancers
            else
                log_error "네이버클라우드 CLI 설정이 필요합니다."
                exit 1
            fi
            ;;
        "natgateways"|"nats")
            if check_required_vars && check_cli && configure_cli; then
                delete_nat_gateways
            else
                log_error "네이버클라우드 CLI 설정이 필요합니다."
                exit 1
            fi
            ;;
        "networkinterfaces"|"nis")
            if check_required_vars && check_cli && configure_cli; then
                delete_network_interfaces
            else
                log_error "네이버클라우드 CLI 설정이 필요합니다."
                exit 1
            fi
            ;;
        "routetables"|"routes")
            if check_required_vars && check_cli && configure_cli; then
                delete_route_tables
            else
                log_error "네이버클라우드 CLI 설정이 필요합니다."
                exit 1
            fi
            ;;
        "internetgateways"|"igws")
            if check_required_vars && check_cli && configure_cli; then
                delete_internet_gateways
            else
                log_error "네이버클라우드 CLI 설정이 필요합니다."
                exit 1
            fi
            ;;
        "cloud")
            if check_required_vars && check_cli && configure_cli; then
                # 올바른 삭제 순서 적용
                delete_server_instances
                sleep 60  # 서버 삭제 완료 대기
                delete_load_balancers
                delete_nat_gateways
                delete_public_ips
                delete_network_interfaces
                delete_acgs
                delete_subnets
                delete_route_tables
                delete_internet_gateways
                delete_vpcs
            else
                log_error "네이버클라우드 CLI 설정이 필요합니다."
                exit 1
            fi
            ;;
        *)
            log_error "지원되지 않는 리소스 타입: $resource_type"
            show_help
            exit 1
            ;;
    esac
}

# 자동 정리 스케줄링
schedule_cleanup() {
    local hours="$1"
    
    if [[ -z "$hours" ]]; then
        log_error "시간을 지정해주세요"
        exit 1
    fi
    
    log_info "$hours시간 후 자동 정리 예약..."
    
    # 백그라운드에서 실행
    (
        sleep $((hours * 3600))
        "$SCRIPT_DIR/auto-cleanup.sh" all
    ) &
    
    local pid=$!
    echo "$pid" > /tmp/auto-cleanup-pid
    log_success "자동 정리 예약 완료 (PID: $pid)"
}

# 도움말 표시
show_help() {
    cat << EOF
🍃 LifeBit 자동화 정리 스크립트

사용법: $SCRIPT_NAME [옵션]

옵션:
    all                          모든 리소스 삭제 (로컬 Docker + 파일 + 클라우드)
    docker                       LifeBit Docker 리소스만 정리
    compose                      Docker Compose 정리
    local                        로컬 파일 정리
    cloud                        네이버클라우드 리소스만 정리 (올바른 순서)
    
    클라우드 개별 리소스:
    servers                      클라우드 서버 인스턴스만 삭제
    loadbalancers, lbs           클라우드 로드밸런서만 삭제
    natgateways, nats            클라우드 NAT Gateway만 삭제
    ips                          클라우드 퍼블릭 IP만 삭제
    networkinterfaces, nis       클라우드 네트워크 인터페이스만 삭제
    acgs                         클라우드 ACG만 삭제
    subnets                      클라우드 서브넷만 삭제
    routetables, routes          클라우드 Route Table만 삭제
    internetgateways, igws       클라우드 Internet Gateway만 삭제
    vpcs                         클라우드 VPC만 삭제
    
    기타:
    schedule [hours]             자동 정리 스케줄링 (시간 단위)
    test                         알림 테스트
    --help, -h                   이 도움말 표시

예시:
    $SCRIPT_NAME all                    # 전체 리소스 삭제 (로컬+클라우드, 올바른 순서)
    $SCRIPT_NAME docker                 # LifeBit Docker만 정리
    $SCRIPT_NAME compose                # Docker Compose 정리
    $SCRIPT_NAME local                  # 로컬 파일만 정리
    $SCRIPT_NAME cloud                  # 네이버클라우드 리소스만 정리 (올바른 순서)
    $SCRIPT_NAME servers                # 클라우드 서버만 삭제
    $SCRIPT_NAME lbs                    # 클라우드 로드밸런서만 삭제
    $SCRIPT_NAME nats                   # 클라우드 NAT Gateway만 삭제
    $SCRIPT_NAME nis                    # 클라우드 네트워크 인터페이스만 삭제
    $SCRIPT_NAME routes                 # 클라우드 Route Table만 삭제
    $SCRIPT_NAME igws                   # 클라우드 Internet Gateway만 삭제
    $SCRIPT_NAME schedule 2             # 2시간 후 자동 삭제
    $SCRIPT_NAME test                   # 알림 테스트

환경 변수:
    ACCESS_KEY          네이버클라우드 액세스 키 (또는 NCP_ACCESS_KEY)
    SECRET_KEY          네이버클라우드 시크릿 키 (또는 NCP_SECRET_KEY)
    PROJECT_NAME        프로젝트 이름 (기본값: LifeBit)
    ENVIRONMENT         환경 (개발/스테이징/프로덕션)
    CLEAN_NODE_MODULES  노드 모듈 정리 여부 (true/false)
    SLACK_WEBHOOK_URL   Slack 알림 웹훅
    DISCORD_WEBHOOK_URL Discord 알림 웹훅

LifeBit 프로젝트 구조:
    apps/ai-api-fastapi/      FastAPI 서버
    apps/core-api-spring/     Spring Boot 서버  
    apps/frontend-vite/       React Frontend
    apps/airflow-pipeline/    Airflow Pipeline
    docker-compose.yml        Docker Compose 설정

의존성:
    docker              Docker 엔진
    docker-compose      Docker Compose
    jq                  JSON 파싱 (클라우드 리소스용)
    ncloud CLI          네이버클라우드 CLI (클라우드 리소스용)

참고:
    - 로컬 Docker 정리는 항상 가능합니다.
    - 클라우드 정리에는 네이버클라우드 CLI와 API 키가 필요합니다.
    - .env 파일에 ACCESS_KEY와 SECRET_KEY 설정을 권장합니다.
    - 알림 기능은 웹훅 URL 설정 시 자동 활성화됩니다.
    - CLEAN_NODE_MODULES=true 설정 시 node_modules도 정리됩니다.
    - VPC 환경에서 실행되며, VServerFullAccess, VPCFullAccess 권한이 필요합니다.
    
    클라우드 리소스 삭제 순서 (의존성 고려):
    1. 서버 인스턴스 → 2. 로드밸런서 → 3. NAT Gateway → 4. 퍼블릭 IP
    5. 네트워크 인터페이스 → 6. ACG → 7. 서브넷 → 8. Route Table
    9. Internet Gateway → 10. VPC (마지막)
    
    - 기본 리소스(기본 VPC, 기본 ACG)는 보호되어 삭제되지 않습니다.
    - 의존성이 있는 리소스는 자동으로 올바른 순서로 삭제됩니다.

EOF
}

# 로컬만 정리하는 함수
local_only_cleanup() {
    log_cleanup "LifeBit 로컬 리소스 정리 시작..."
    
    cleanup_docker_compose
    cleanup_lifebit_docker
    cleanup_local_files
    
    log_success "LifeBit 로컬 리소스 정리 완료"
}

# 알림 테스트 (LifeBit용으로 수정)
test_notifications() {
    log_info "LifeBit 정리 알림 테스트 시작..."
    
    # 정리 시작 알림 테스트
    notify_cleanup_start "LifeBit" "테스트 리소스"
    
    # 정리 단계 알림 테스트
    notify_cleanup_step "Docker Compose 정리" "success" "LifeBit Docker Compose 서비스 2개가 정리되었습니다."
    notify_cleanup_step "FastAPI 컨테이너 삭제" "success" "LifeBit FastAPI 컨테이너가 삭제되었습니다."
    notify_cleanup_step "Spring Boot 컨테이너 삭제" "success" "LifeBit Spring Boot 컨테이너가 삭제되었습니다."
    notify_cleanup_step "Frontend 컨테이너 삭제" "success" "LifeBit React Frontend 컨테이너가 삭제되었습니다."
    notify_cleanup_step "Airflow 컨테이너 삭제" "success" "LifeBit Airflow 컨테이너가 삭제되었습니다."
    notify_cleanup_step "로컬 파일 정리" "success" "LifeBit 임시 파일 및 빌드 아티팩트가 정리되었습니다."
    
    # 정리 완료 알림 테스트
    notify_cleanup_success "LifeBit" "테스트 리소스" "7개"
    
    log_success "LifeBit 정리 알림 테스트 완료"
}

# 메인 함수
main() {
    log_info "🍃 LifeBit 자동 정리 스크립트 시작..."
    
    load_env
    
    case "${1:-}" in
        "test")
            test_notifications
            return 0
            ;;
        "--help"|"-h"|"")
            show_help
            return 0
            ;;
        "all")
            notify_cleanup_start "$PROJECT_NAME" "전체 리소스"
            cleanup_all
            notify_cleanup_success "$PROJECT_NAME" "전체 리소스" "전체"
            ;;
        "docker"|"compose"|"local"|"cloud"|"servers"|"ips"|"acgs"|"subnets"|"vpcs"|"loadbalancers"|"lbs"|"natgateways"|"nats"|"networkinterfaces"|"nis"|"routetables"|"routes"|"internetgateways"|"igws")
            notify_cleanup_start "$PROJECT_NAME" "$1"
            cleanup_specific "$1"
            notify_cleanup_success "$PROJECT_NAME" "$1" "선택된 리소스"
            ;;
        "schedule")
            schedule_cleanup "$2"
            ;;
        *)
            log_error "알 수 없는 옵션: $1"
            show_help
            exit 1
            ;;
    esac
}

# 오류 처리
handle_error() {
    local exit_code=$?
    local line_number=$1
    
    log_error "오류 발생: 라인 $line_number, 종료 코드: $exit_code"
    notify_cleanup_failure "$PROJECT_NAME" "라인 $line_number에서 오류 발생 (종료 코드: $exit_code)"
    
    exit $exit_code
}

# 오류 트랩 설정
trap 'handle_error $LINENO' ERR

# 스크립트 실행
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 