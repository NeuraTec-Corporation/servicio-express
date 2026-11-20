import * as echarts from 'echarts/core';
import {BarChart,LineChart,PieChart,HeatmapChart} from 'echarts/charts';
import {AriaComponent,GraphicComponent,DataZoomComponent,GridComponent,LegendComponent,TooltipComponent,VisualMapComponent} from 'echarts/components';
import {SVGRenderer} from 'echarts/renderers';
echarts.use([BarChart,LineChart,PieChart,HeatmapChart,AriaComponent,GraphicComponent,DataZoomComponent,GridComponent,LegendComponent,TooltipComponent,VisualMapComponent,SVGRenderer]);
export {echarts};
