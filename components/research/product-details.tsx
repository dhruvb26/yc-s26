"use client";

import { Star } from "lucide-react";
import type { ProductInfo } from "@/app/_actions";

interface ProductDetailsProps {
  product: ProductInfo;
  sourceUrl: string;
}

export function ProductDetails({ product, sourceUrl }: ProductDetailsProps) {
  const hasImage = product.imageUrl?.startsWith("http");

  return (
    <div className="space-y-4">
      <SectionHeader>Product</SectionHeader>
      
      <div className="space-y-4">
        {/* Product Image */}
        {hasImage && (
          <div className="w-32 h-32 rounded border bg-muted/30 overflow-hidden">
            <img
              src={product.imageUrl}
              alt={product.title || "Product"}
              className="w-full h-full object-contain"
            />
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            {product.brand && (
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {product.brand}
              </p>
            )}
            <h2 className="text-lg font-semibold leading-snug">
              {product.title || "Unknown Product"}
            </h2>
            {product.category && (
              <p className="text-xs text-muted-foreground">{product.category}</p>
            )}
          </div>
          {product.price && (
            <p className="text-lg font-semibold shrink-0">{product.price}</p>
          )}
        </div>

        {product.rating != null && product.rating > 0 && <Rating value={product.rating} count={product.reviewCount} />}
        
        {product.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {product.description}
          </p>
        )}

        {product.features && product.features.length > 0 && (
          <FeatureList features={product.features} />
        )}

        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View source →
        </a>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
      {children}
    </h3>
  );
}

function Rating({ value, count }: { value: number; count?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`size-3.5 ${
              star <= Math.round(value)
                ? "fill-foreground text-foreground"
                : "text-muted-foreground/30"
            }`}
          />
        ))}
      </div>
      <span className="text-sm font-medium">{value}</span>
      {count && <span className="text-xs text-muted-foreground">({count})</span>}
    </div>
  );
}

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="space-y-1.5">
      {features.slice(0, 4).map((feature, i) => (
        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
          <span className="text-muted-foreground/50 mt-1.5">•</span>
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}
