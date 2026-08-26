"use client"

import { Store, TrendingUp, FileText, Download } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function QuickActions({
  onNavigate,
}: {
  onNavigate?: (key: string) => void
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold">การดำเนินการด่วน</h2>
          <p className="text-sm text-muted-foreground">
            บันทึกข้อมูลธุรกิจของคุณได้อย่างรวดเร็ว
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2" onClick={() => onNavigate?.("costs")}>
            <Store className="h-4 w-4" />
            เพิ่มร้านค้า/บันทึกต้นทุน
          </Button>
          <Button
            variant="secondary"
            className="gap-2"
            onClick={() => onNavigate?.("tax")}
          >
            <TrendingUp className="h-4 w-4" />
            บันทึกยอดขาย
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => onNavigate?.("tax")}
          >
            <FileText className="h-4 w-4" />
            สร้างรายงาน
          </Button>
          <Button variant="outline" size="icon" aria-label="ส่งออกข้อมูล">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
