import { ProductScraper } from "@/components/product-scraper";

export default function Home() {
  return (
    <main className="h-screen overflow-hidden">
      <div className="h-full max-w-5xl mx-auto px-6 py-6">
        <ProductScraper />
      </div>
    </main>
  );
}
