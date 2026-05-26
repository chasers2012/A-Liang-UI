项目总览、功能说明与完整快速上手见仓库根目录 [README.md](../../README.md)。

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### 数据源页与 quant-agent API

「数据源」页面会请求 **quant-agent FastAPI**（默认 `http://127.0.0.1:8000/api`）。应用入口为 [http://localhost:3000](http://localhost:3000)。本地需同时启动 API，例如在仓库根目录：

```bash
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

环境变量：

| 变量                          | 作用                                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_QUANT_AGENT_API` | 前端请求的 API 基址（勿以 `/` 结尾）。本地默认 `http://127.0.0.1:8000/api`；Docker 默认同源 `/api`。                             |
| `QUANT_AGENT_WORKSPACE`       | **在运行 API 的进程里**设置：数据源配置文件写入该目录下 `config/datasources.json`。未设置时默认为用户主目录下的 `.quant-agent`。 |

API 的 CORS 默认允许 `http://localhost:3000`；其他来源请设置 API 进程的 `CORS_ORIGINS`（逗号分隔）。

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
