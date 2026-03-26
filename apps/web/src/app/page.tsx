import { Page } from "@/components/page";

export default function HomePage() {
  return (
    <Page>
      <h1 className="text-2xl font-semibold tracking-tight">首页</h1>
      <p className="mt-2 text-muted-foreground">
        quant-agent Web 控制台。使用左侧菜单导航，可点击边缘按钮折叠侧边栏。
      </p>
    </Page>
  );
}
