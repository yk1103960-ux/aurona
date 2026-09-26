import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Columns3,
  Copy,
  Download,
  ExternalLink,
  ImageIcon,
  Minus,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRealtime } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import {
  adminAdjustInventory,
  adminBulkProductFamilyAction,
  adminDeleteProductFamilyPermanent,
  adminDeleteProductVariantPermanent,
  adminDuplicateProductFamily,
  adminListProductMaster,
  adminSaveProductMasterRows,
  adminSetProductVariantState,
} from "@/lib/catalog-admin.functions";

export const Route = createFileRoute("/aurona-console-9f2x7k/products/master")({
  component: ProductMaster,
});

type Variant = {
  id: string;
  family_id: string;
  sku: string;
  barcode: string;
  attributes: Record<string, string>;
  mrp: number | null;
  price: number | null;
  discount_pct: number | null;
  retailer_mrp: number | null;
  retailer_price: number | null;
  retailer_discount_pct: number | null;
  retailer_stock: number | null;
  retailer_pack_size: number | null;
  distributor_mrp: number | null;
  distributor_price: number | null;
  distributor_discount_pct: number | null;
  distributor_stock: number | null;
  distributor_pack_size: number | null;
  moq: number | null;
  retailer_moq: number | null;
  distributor_moq: number | null;
  stock: number;
  reserved_stock: number;
  pack_size: number | null;
  weight_g: number | null;
  dim_l: number | null;
  dim_w: number | null;
  dim_h: number | null;
  pack_weight_g: number | null;
  pack_l: number | null;
  pack_w: number | null;
  pack_h: number | null;
  retailer_pack_weight_g: number | null;
  retailer_pack_l: number | null;
  retailer_pack_w: number | null;
  retailer_pack_h: number | null;
  distributor_pack_weight_g: number | null;
  distributor_pack_l: number | null;
  distributor_pack_w: number | null;
  distributor_pack_h: number | null;
  is_active: boolean;
  available_customer: boolean;
  available_retailer: boolean;
  available_distributor: boolean;
  archived_at: string | null;
  low_stock_threshold: number;
  sort_order: number;
  updated_at: string;
};
