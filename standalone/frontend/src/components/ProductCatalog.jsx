import React from "react";
import { motion } from "framer-motion";
import { Boxes, Gauge, Medal, Wrench } from "lucide-react";

export default function ProductCatalog({ products = [] }) {
  return (
    <section className="rounded-[32px] border border-cyan-300/20 bg-white/5 p-6 shadow-[0_20px_64px_rgba(6,182,212,0.12)] backdrop-blur">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">Product Catalog</p>
          <h2 className="mt-2 text-2xl font-black text-white">Available manufacturing products and materials</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
            Customers can review what the factory currently supports before sending an AI order request.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product, index) => (
          <motion.article
            key={product.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-[28px] border border-cyan-300/20 bg-gradient-to-br from-cyan-300/10 to-slate-900/40 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-white">{product.productName}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Built for manufacturing requests that need exact product-to-material mapping.
                </p>
              </div>
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                {product.id}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                  <Wrench size={12} />
                  Material
                </div>
                <p className="mt-2 text-sm font-semibold text-white">{product.material}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                  <Medal size={12} />
                  Quality Grade
                </div>
                <p className="mt-2 text-sm font-semibold text-white">{product.qualityGrade}</p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                <Gauge size={12} />
                Available Quantity
              </div>
              <p className="mt-2 text-lg font-black text-cyan-100">{product.availableQuantity}</p>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                <Boxes size={12} />
                Supported Materials
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[product.material].map((material) => (
                  <span
                    key={`${product.id}-${material}`}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200"
                  >
                    {material}
                  </span>
                ))}
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
