import { describe, expect, it } from "vitest";
import { circleFromCenterRadius, circleFromCoefficients } from "../src/circleGeometry.js";
import { degreesToPiRadians, getCircleReadout } from "../src/circleReadout.js";

const read = (rows: ReturnType<typeof getCircleReadout>, label: string) =>
  rows.find(row => row.label === label);

describe("Circle scientific readout", () => {
  it("shows pi exactly for length and area, with trajectory-style labels", () => {
    const circle = circleFromCenterRadius([-4.62,0],3);
    const rows = getCircleReadout({mode:"center-radius",showEquation:true},circle);
    expect(read(rows,"Centro")?.value).toBe("\\left(-4.62,\\;0\\right)");
    expect(read(rows,"Longitud de circunferencia")).toMatchObject({value:"6\\pi",math:true});
    expect(read(rows,"Área del círculo")).toMatchObject({value:"9\\pi",math:true});
    expect(read(rows,"Ecuación general")?.math).toBe(true);
    expect(read(rows,"Cortes con eje Y")?.value).toBe("Ninguno");
    expect(read(rows,"Cortes con eje X")?.value).toContain("-7.62");
  });

  it("formats radians as simplified rational multiples of pi", () => {
    expect(degreesToPiRadians(0)).toBe("0");
    expect(degreesToPiRadians(30)).toBe("\\frac{\\pi}{6}");
    expect(degreesToPiRadians(45)).toBe("\\frac{\\pi}{4}");
    expect(degreesToPiRadians(120)).toBe("\\frac{2\\pi}{3}");
    expect(degreesToPiRadians(180)).toBe("\\pi");
    expect(degreesToPiRadians(270)).toBe("\\frac{3\\pi}{2}");
    expect(degreesToPiRadians(-90)).toBe("-\\frac{\\pi}{2}");
    expect(degreesToPiRadians(22.123456)).toContain("\\approx");
  });

  it("shows angles only for visible geometric aids", () => {
    const geometry = circleFromCenterRadius([0,0],2);
    const result = getCircleReadout({
      mode:"canonical",showRadius:true,radiusAngle:30,showDiameter:false,
      showChord:true,chordStartAngle:45,chordEndAngle:180,
      showTangent:true,tangentAngle:60,showEquation:false,
    },geometry);
    expect(read(result,"Dirección del radio")?.value).toBe("\\frac{\\pi}{6}");
    expect(read(result,"Cuerda: ángulo inicial")?.value).toBe("\\frac{\\pi}{4}");
    expect(read(result,"Cuerda: ángulo final")?.value).toBe("\\pi");
    expect(read(result,"Punto de tangencia: ángulo")?.value).toBe("\\frac{\\pi}{3}");
    expect(read(result,"Dirección del diámetro")).toBeUndefined();
    expect(read(result,"Ecuación general")).toBeUndefined();
  });

  it("preserves simple radicals for equation-defined circles", () => {
    const circle = circleFromCoefficients({A:1,B:0,C:1,D:0,E:0,F:-2});
    const rows = getCircleReadout({mode:"general"},circle);
    expect(read(rows,"Radio")?.value).toBe("\\sqrt{2}");
    expect(read(rows,"Longitud de circunferencia")?.value).toBe("2\\sqrt{2}\\pi");
    expect(read(rows,"Área del círculo")?.value).toBe("2\\pi");
  });

  it("does not replace arbitrary decimals with false radical identities", () => {
    const geometry = circleFromCenterRadius([0,0],1.25);
    const rows = getCircleReadout({mode:"center-radius"},geometry);
    expect(read(rows,"Longitud de circunferencia")?.value).toBe("2.5\\pi");
    expect(read(rows,"Área del círculo")?.value).toBe("1.5625\\pi");
  });
});
