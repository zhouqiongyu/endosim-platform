/**
 * 前端后端地址配置
 *
 * 本地开发（npm start）：保持为空字符串，前端会使用相对路径 /api/coze/token
 * CloudBase / SCF 部署后：将 COZE_TOKEN_URL 改为 SCF 云函数的 API 网关触发地址
 *
 * 示例：
 * window.COZE_TOKEN_URL = 'https://service-xxx.gz.apigw.tencentcs.com/release/coze-token';
 */
window.COZE_TOKEN_URL = '';
