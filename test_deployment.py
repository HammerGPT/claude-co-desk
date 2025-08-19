#!/usr/bin/env python3
"""
数字员工自动部署系统测试脚本
用于验证整个hook -> 部署 -> 通知流程是否正常工作
"""

import json
import os
import shutil
import tempfile
import time
from pathlib import Path
from setup_hooks import HookManager
from deploy_agents import AgentDeployer
import requests

def test_hook_configuration():
    """测试hook配置功能"""
    print("🔧 测试1: Hook配置功能")
    
    hook_manager = HookManager()
    
    # 检查初始状态
    status = hook_manager.check_hook_status()
    print(f"   初始状态: {status}")
    
    # 清理可能存在的旧配置
    if status["configured"]:
        print("   清理旧配置...")
        hook_manager.remove_hooks()
    
    # 配置新的hooks
    print("   配置hooks...")
    success = hook_manager.setup_claude_hooks()
    if success:
        print("   ✅ Hook配置成功")
    else:
        print("   ❌ Hook配置失败")
        return False
    
    # 验证配置结果
    status = hook_manager.check_hook_status()
    print(f"   配置后状态: {status}")
    
    return status["configured"]

def test_agent_deployment():
    """测试数字员工部署功能"""
    print("🚀 测试2: 数字员工部署功能")
    
    deployer = AgentDeployer()
    
    # 创建模拟的transcript文件
    transcript_content = """
初始化用户电脑的根目录/主目录

这是一个模拟的初始化会话：
- 分析主目录整体结构和文件分布
- 识别开发项目、工作文档、个人文件分类

... 其他初始化内容 ...

所有TodoList项目标记为完成
生成最终的初始化总结报告  
确认系统已AI化并准备就绪
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
        f.write(transcript_content)
        transcript_path = f.name
    
    try:
        print(f"   使用模拟transcript: {transcript_path}")
        
        # 清理可能存在的旧部署
        if deployer.deployed_marker.exists():
            deployer.deployed_marker.unlink()
            print("   清理旧部署标记")
        
        # 清理已部署的agent文件
        for agent_file in deployer.expected_agents:
            agent_path = deployer.target_dir / agent_file
            if agent_path.exists():
                agent_path.unlink()
                print(f"   清理旧agent文件: {agent_file}")
        
        # 测试部署流程
        success = deployer.run(transcript_path)
        
        if success:
            print("   ✅ 数字员工部署成功")
            
            # 验证部署结果
            deployed_count = 0
            for agent_file in deployer.expected_agents:
                agent_path = deployer.target_dir / agent_file
                if agent_path.exists():
                    deployed_count += 1
                    print(f"   ✅ 已部署: {agent_file}")
                else:
                    print(f"   ❌ 缺失: {agent_file}")
            
            print(f"   部署统计: {deployed_count}/{len(deployer.expected_agents)} 个员工")
            return deployed_count == len(deployer.expected_agents)
        else:
            print("   ❌ 数字员工部署失败")
            return False
            
    finally:
        # 清理测试文件
        os.unlink(transcript_path)

def test_api_endpoint():
    """测试API端点"""
    print("🌐 测试3: API端点功能")
    
    try:
        # 测试数据
        test_data = {
            "status": "success",
            "message": "测试部署完成",
            "deployed_agents": [
                "document-manager.md",
                "work-assistant.md", 
                "finance-assistant.md",
                "info-collector.md",
                "fullstack-engineer.md"
            ],
            "timestamp": "2025-01-09T12:00:00"
        }
        
        print("   发送测试请求到API端点...")
        
        # 从环境变量获取API地址
        heliki_host = os.getenv('HELIKI_HOST', 'localhost')
        heliki_port = os.getenv('HELIKI_PORT', '3005')
        api_url = f"http://{heliki_host}:{heliki_port}/api/agents-deployed"
        
        # 发送POST请求
        response = requests.post(
            api_url,
            json=test_data,
            timeout=5
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ API响应成功: {result}")
            return True
        else:
            print(f"   ❌ API响应失败: {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("   ⚠️ 无法连接到Heliki OS服务器")
        print("   请确保运行 'python app.py' 启动服务器")
        return False
    except Exception as e:
        print(f"   ❌ API测试出错: {e}")
        return False

def test_source_files():
    """测试源文件完整性"""
    print("📁 测试4: 源文件完整性")
    
    deployer = AgentDeployer()
    
    if not deployer.source_dir.exists():
        print(f"   ❌ 源目录不存在: {deployer.source_dir}")
        return False
    
    missing_files = []
    for agent_file in deployer.expected_agents:
        source_file = deployer.source_dir / agent_file
        if not source_file.exists():
            missing_files.append(agent_file)
            print(f"   ❌ 缺失源文件: {agent_file}")
        else:
            # 检查文件内容
            try:
                with open(source_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if len(content) < 100:
                        print(f"   ⚠️ 源文件内容过短: {agent_file}")
                    else:
                        print(f"   ✅ 源文件正常: {agent_file} ({len(content)} 字符)")
            except Exception as e:
                print(f"   ❌ 读取源文件失败 {agent_file}: {e}")
                missing_files.append(agent_file)
    
    if missing_files:
        print(f"   ❌ 缺失 {len(missing_files)} 个源文件")
        return False
    else:
        print(f"   ✅ 所有 {len(deployer.expected_agents)} 个源文件完整")
        return True

def run_full_test():
    """运行完整测试"""
    print("🧪 开始数字员工自动部署系统完整测试")
    print("=" * 60)
    
    test_results = []
    
    # 测试1: 源文件完整性
    test_results.append(("源文件完整性", test_source_files()))
    
    # 测试2: Hook配置
    test_results.append(("Hook配置", test_hook_configuration()))
    
    # 测试3: 数字员工部署
    test_results.append(("数字员工部署", test_agent_deployment()))
    
    # 测试4: API端点
    test_results.append(("API端点", test_api_endpoint()))
    
    # 打印测试结果
    print("\n" + "=" * 60)
    print("📊 测试结果总结:")
    
    passed_count = 0
    for test_name, result in test_results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"   {test_name:<20} {status}")
        if result:
            passed_count += 1
    
    print(f"\n总体结果: {passed_count}/{len(test_results)} 项测试通过")
    
    if passed_count == len(test_results):
        print("🎉 所有测试通过！数字员工自动部署系统已就绪！")
        return True
    else:
        print(f"⚠️ 有 {len(test_results) - passed_count} 项测试失败，请检查配置")
        return False

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        
        if command == "hooks":
            success = test_hook_configuration()
            sys.exit(0 if success else 1)
        elif command == "deploy":
            success = test_agent_deployment()
            sys.exit(0 if success else 1)
        elif command == "api":
            success = test_api_endpoint()
            sys.exit(0 if success else 1)
        elif command == "files":
            success = test_source_files()
            sys.exit(0 if success else 1)
        else:
            print("用法: python test_deployment.py [hooks|deploy|api|files]")
            sys.exit(1)
    else:
        # 运行完整测试
        success = run_full_test()
        sys.exit(0 if success else 1)