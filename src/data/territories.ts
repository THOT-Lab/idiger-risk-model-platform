import type { Hazard, Territory } from '../lib/types';
export const hazardInfo: Record<Hazard,{name:string;short:string;color:string;eyebrow:string;description:string}> = {
 torrential:{name:'Avenidas torrenciales',short:'Avenidas torrenciales',color:'#71c7f5',eyebrow:'CUENCAS DE MONTAÑA',description:'De la lluvia en los cerros al impacto aguas abajo.'},
 flood:{name:'Inundaciones',short:'Inundaciones',color:'#71d6c0',eyebrow:'SISTEMA HÍDRICO URBANO',description:'El agua, la ciudad y sus zonas de encuentro.'},
 landslide:{name:'Movimientos en masa',short:'Movimientos en masa',color:'#e5b078',eyebrow:'LADERAS Y TERRITORIO',description:'Comprender la ladera. Anticipar sus efectos.'},
};
export { default as geography } from './geography.json';
import geography from './geography.json';
export const territories=geography as unknown as Territory[];
export const defaultScenario = {preset:'severe' as const,tr:50,duration:60,rain:65,saturation:70,slope:32,shaking:0,intervention:30,drainage:40};
