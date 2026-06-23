'use client'
import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

type Props = {
  value: string
  height?: number
}

export default function BarcodeSvg({ value, height = 40 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, value, {
        format: 'EAN13',
        height,
        fontSize: 12,
        margin: 4,
      })
    }
  }, [value, height])

  return <svg ref={svgRef} />
}
