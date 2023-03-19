import qs from "qs";

export function classJoin(...classes: Array<string | null | undefined | false>) {
  return classes.filter(x => x).join(" ") || undefined;
}

export function qsStringify(obj: any, options?: qs.IStringifyOptions) {
  return qs.stringify(
    obj,
    {
      arrayFormat: "brackets",
      addQueryPrefix: true,
      ...options,
    },
  );
}

export function qsParse(str: string, options?: qs.IParseOptions) {
  return qs.parse(
    str,
    {
      ignoreQueryPrefix: true,
      ...options,
    },
  );
}

export function hsv(h: number, s: number, v: number, a = 1.0) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  
  let r, g, b;
  switch(i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
    default: r = 0; g = 0; b = 0; break;
  }
  
  return rgb(r, g, b, a);
}

export function rgb(r: number, g: number, b: number, a = 1.0) {
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
}
