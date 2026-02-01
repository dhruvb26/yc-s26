"use client";

import { useState } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import type { ProductInfo } from "@/app/_actions";

interface ProductDetailsProps {
  product: ProductInfo;
  sourceUrl: string;
}

export function ProductDetails({ product, sourceUrl }: ProductDetailsProps) {
  // Combine imageUrl and imageUrls, filter valid URLs
  const allImages = [
    product.imageUrl,
    ...(product.imageUrls || []),
  ].filter((url): url is string => !!url && url.startsWith("http"));
  
  // Remove duplicates
  const uniqueImages = [...new Set(allImages)];
  
  const [selectedImage, setSelectedImage] = useState(0);

  return (
    <div className="space-y-4">
      <SectionHeader>Product</SectionHeader>
      
      <div className="space-y-4">
        {/* Image Gallery */}
        {uniqueImages.length > 0 && (
          <div className="space-y-3">
            {/* Main Image */}
            <div className="relative w-full aspect-square max-w-xs rounded-lg border bg-muted/30 overflow-hidden">
              <img
                src={uniqueImages[selectedImage]}
                alt={product.title || "Product"}
                className="w-full h-full object-contain"
              />
              
              {/* Navigation Arrows */}
              {uniqueImages.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedImage((prev) => (prev === 0 ? uniqueImages.length - 1 : prev - 1))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-background/80 border flex items-center justify-center hover:bg-background transition-colors"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    onClick={() => setSelectedImage((prev) => (prev === uniqueImages.length - 1 ? 0 : prev + 1))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-background/80 border flex items-center justify-center hover:bg-background transition-colors"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </>
              )}
              
              {/* Image Counter */}
              {uniqueImages.length > 1 && (
                <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-background/80 text-xs">
                  {selectedImage + 1} / {uniqueImages.length}
                </div>
              )}
            </div>
            
            {/* Thumbnails */}
            {uniqueImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {uniqueImages.slice(0, 8).map((url, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`shrink-0 size-14 rounded border overflow-hidden transition-all ${
                      selectedImage === index
                        ? "ring-2 ring-foreground ring-offset-2"
                        : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Product image ${index + 1}`}
                      className="w-full h-full object-contain bg-muted/30"
                    />
                  </button>
                ))}
              </div>
            )}
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
      {features.slice(0, 5).map((feature, i) => (
        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
          <span className="text-muted-foreground/50 mt-1.5">•</span>
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}
