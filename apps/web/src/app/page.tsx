import { HomeDemo } from "@/components/home-demo";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">quant-agent</h1>
        <p className="mt-2 text-muted-foreground">
          Next.js · shadcn · Tailwind · Jotai · Python API
        </p>
      </div>
      <HomeDemo />
    </div>
  );
}
