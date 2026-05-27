import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { Typography } from 'antd'
import { useThemeStore } from '../../stores'
import type { OperationLogCategoryStat } from '../../utils'
import { OPERATION_LOG_CATEGORY_ACCENTS } from './operationLogCategoryVisuals'

echarts.use([BarChart, LineChart, PieChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer])

const { Text } = Typography

interface CategoryProportionChartProps {
  items: OperationLogCategoryStat[]
  total: number
}

function chartTheme(isDark: boolean) {
  return {
    textPrimary: isDark ? '#f2f4f8' : '#1f2329',
    textSecondary: isDark ? '#a8b0bd' : '#5d6673',
    textTertiary: isDark ? '#7a8494' : '#8a94a6',
    border: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.08)',
    tooltipBg: isDark ? 'rgba(28, 33, 43, 0.96)' : 'rgba(255, 255, 255, 0.96)',
  }
}

const CategoryProportionChart: React.FC<CategoryProportionChartProps> = ({ items, total }) => {
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme)
  const isDark = resolvedTheme === 'dark'

  const segments = useMemo(
    () => items.filter((c) => c.count > 0).sort((a, b) => b.count - a.count),
    [items]
  )

  const { pieOption, barOption } = useMemo(() => {
    if (segments.length === 0) {
      return { pieOption: {} as EChartsOption, barOption: {} as EChartsOption }
    }

    const theme = chartTheme(isDark)
    const safeTotal = Math.max(1, total)
    const labels = segments.map((s) => s.label)
    const colors = segments.map((s) => OPERATION_LOG_CATEGORY_ACCENTS[s.category])

    const tooltipBase = {
      backgroundColor: theme.tooltipBg,
      borderColor: theme.border,
      textStyle: { color: theme.textPrimary, fontSize: 12 },
    }

    const pieOption: EChartsOption = {
      tooltip: {
        ...tooltipBase,
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { name?: string; value?: number; percent?: number }
          return `${p.name ?? ''}<br/>${p.value ?? 0} 次 · ${Math.round(p.percent ?? 0)}%`
        },
      },
      legend: {
        orient: 'horizontal',
        bottom: 0,
        left: 'center',
        icon: 'roundRect',
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 10,
        textStyle: { color: theme.textSecondary, fontSize: 11 },
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '62%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: isDark ? '#1c212b' : '#ffffff',
            borderWidth: 2,
          },
          label: {
            show: true,
            position: 'center',
            formatter: `{total|${total}}\n{unit|次}`,
            rich: {
              total: {
                fontSize: 20,
                fontWeight: 700,
                color: theme.textPrimary,
                lineHeight: 26,
              },
              unit: {
                fontSize: 12,
                color: theme.textTertiary,
                lineHeight: 18,
              },
            },
          },
          emphasis: {
            scale: true,
            scaleSize: 6,
            label: { show: false },
          },
          labelLine: { show: false },
          data: segments.map((s) => ({
            name: s.label,
            value: s.count,
            itemStyle: { color: OPERATION_LOG_CATEGORY_ACCENTS[s.category] },
          })),
        },
      ],
    }

    const percentages = segments.map((s) => Math.round((s.count / safeTotal) * 100))
    const lineColor = isDark ? '#ffb340' : '#ff9f0a'

    const barOption: EChartsOption = {
      legend: {
        data: ['次数', '占比'],
        top: 0,
        right: 0,
        icon: 'roundRect',
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 12,
        textStyle: { color: theme.textSecondary, fontSize: 11 },
      },
      tooltip: {
        ...tooltipBase,
        trigger: 'axis',
        axisPointer: { type: 'cross', crossStyle: { color: theme.textTertiary } },
        formatter: (params: unknown) => {
          const rows = (Array.isArray(params) ? params : [params]) as Array<{
            name?: string
            seriesName?: string
            value?: number
            marker?: string
          }>
          const title = rows[0]?.name ?? ''
          const lines = rows.map((row) => {
            const value = Number(row.value ?? 0)
            if (row.seriesName === '占比') {
              return `${row.marker ?? ''}${row.seriesName}：${value}%`
            }
            return `${row.marker ?? ''}${row.seriesName ?? '次数'}：${value} 次`
          })
          return [title, ...lines].join('<br/>')
        },
      },
      grid: { left: 8, right: 48, top: 28, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: theme.border } },
        axisTick: { show: false },
        axisLabel: {
          color: theme.textSecondary,
          fontSize: 11,
          interval: 0,
          rotate: labels.some((l) => l.length > 5) ? 28 : 0,
        },
      },
      yAxis: [
        {
          type: 'value',
          name: '次数',
          minInterval: 1,
          nameTextStyle: { color: theme.textTertiary, fontSize: 11 },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: theme.textTertiary, fontSize: 11 },
          splitLine: { lineStyle: { color: theme.border, type: 'dashed' } },
        },
        {
          type: 'value',
          name: '占比',
          min: 0,
          max: 100,
          nameTextStyle: { color: theme.textTertiary, fontSize: 11 },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: theme.textTertiary,
            fontSize: 11,
            formatter: '{value}%',
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '次数',
          type: 'bar',
          yAxisIndex: 0,
          data: segments.map((s, i) => ({
            value: s.count,
            itemStyle: {
              color: colors[i],
              borderRadius: [8, 8, 4, 4],
            },
          })),
          barMaxWidth: 48,
        },
        {
          name: '占比',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { width: 2, color: lineColor },
          itemStyle: {
            color: lineColor,
            borderColor: isDark ? '#1c212b' : '#ffffff',
            borderWidth: 2,
          },
          emphasis: {
            scale: true,
            itemStyle: {
              borderColor: isDark ? '#1c212b' : '#ffffff',
              borderWidth: 2,
            },
          },
          data: percentages,
        },
      ],
    }

    return { pieOption, barOption }
  }, [segments, total, isDark])

  if (segments.length === 0) {
    return <Text type="secondary">暂无分类数据</Text>
  }

  const chartHeight = 300

  return (
    <div className="user-center-category-chart" role="figure">
      <div className="user-center-category-chart__pane user-center-category-chart__pane--pie">
        <Text type="secondary" className="user-center-category-chart__pane-label">
          占比分布
        </Text>
        <ReactECharts
          key={`pie-${resolvedTheme}`}
          echarts={echarts}
          option={pieOption}
          notMerge
          style={{ height: chartHeight, width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </div>
      <div className="user-center-category-chart__pane user-center-category-chart__pane--bar">
        <Text type="secondary" className="user-center-category-chart__pane-label">
          次数与占比
        </Text>
        <ReactECharts
          key={`bar-${resolvedTheme}`}
          echarts={echarts}
          option={barOption}
          notMerge
          style={{ height: chartHeight, width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </div>
    </div>
  )
}

export default CategoryProportionChart
