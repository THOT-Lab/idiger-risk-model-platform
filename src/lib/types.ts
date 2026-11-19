import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';
export type Hazard = 'torrential' | 'flood' | 'landslide';
export type Stage = 'territory' | 'scenario' | 'result';
export type Preset = 'frequent' | 'severe' | 'extreme';
export type ViewMode = 'risk' | 'hazard';
export interface Territory {
 id:string; name:string; subtitle:string; hazard:Hazard; center:[number,number]; focus:[number,number]; zoom:number;
 area:number; population:number; description:string; polygon:[number,number][]; geometry:Polygon|MultiPolygon;
 bounds:[number,number,number,number]; river:[number,number][]; waterways:FeatureCollection; hydroCode?:string; boundarySource:string; sourceIds:string[];
}
export interface Station {id:string;name:string;type:string;coordinates:[number,number];elevation:string;operator:string;locality:string;catalogStatus:string;provenance:string;live:false;}
export interface Scenario {preset:Preset;tr?:number;duration:number;rain:number;saturation:number;slope:number;shaking:number;intervention:number;drainage:number;}
export interface BuildingProperties {id:number;sourceId?:string;zone:string;height:number;people:number;value:number;vulnerability:number;exposure:number;use:'Vivienda'|'Comercio'|'Equipamiento';footprintSource?:string;distanceToWater?:number;area?:number;slideAlong?:number;slideDistance?:number;}
export type Building=Feature<Polygon|MultiPolygon,BuildingProperties>;
export type Buildings=FeatureCollection<Polygon|MultiPolygon,BuildingProperties>;
export interface Result {total:number;high:number;medium:number;low:number;exposed:number;people:number;criticalPeople:number;direct:number;indirect:number;totalLoss:number;depth:number;area:number;severity:number;services:number;progress:number;}
export interface SavedScenario {id:string;name:string;territory:string;hazard:Hazard;scenario:Scenario;result:Result;created:string;}
export interface Gap {id:string;category:'Datos'|'Modelación'|'Validación'|'Integración';priority:'P1'|'P2'|'P3';title:string;owner:string;assumption:string;action:string;acceptance:string;source?:string;}
export interface TerrainData {bounds:[number,number,number,number];size:number;heights:number[];source:string;}
