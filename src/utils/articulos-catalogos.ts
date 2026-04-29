export type CatalogosArticulos = {
  categorias: string[];
  marcas: string[];
  fabricantes: string[];
};

const STORAGE_KEY = "cosmetikera.catalogosArticulos.v1";

const normalizarLista = (values: unknown[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of values) {
    const item = String(raw ?? "").trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
};

const emptyCatalogos = (): CatalogosArticulos => ({
  categorias: [],
  marcas: [],
  fabricantes: [],
});

export const mergeCatalogos = (...catalogos: Array<Partial<CatalogosArticulos> | null | undefined>): CatalogosArticulos => {
  const categorias: string[] = [];
  const marcas: string[] = [];
  const fabricantes: string[] = [];

  for (const c of catalogos) {
    if (!c) continue;
    categorias.push(...(Array.isArray(c.categorias) ? c.categorias : []));
    marcas.push(...(Array.isArray(c.marcas) ? c.marcas : []));
    fabricantes.push(...(Array.isArray(c.fabricantes) ? c.fabricantes : []));
  }

  return {
    categorias: normalizarLista(categorias),
    marcas: normalizarLista(marcas),
    fabricantes: normalizarLista(fabricantes),
  };
};

export const getCatalogosArticulosLocal = (): CatalogosArticulos => {
  if (typeof window === "undefined") return emptyCatalogos();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyCatalogos();
    const parsed = JSON.parse(raw) as Partial<CatalogosArticulos>;
    return mergeCatalogos(parsed);
  } catch {
    return emptyCatalogos();
  }
};

export const saveCatalogosArticulosLocal = (catalogos: Partial<CatalogosArticulos>): CatalogosArticulos => {
  const merged = mergeCatalogos(catalogos);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  }
  return merged;
};
