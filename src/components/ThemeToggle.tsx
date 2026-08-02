import { Button } from "@/components/ui/button"
import { themeStore } from "@/lib/theme"
import { MoonIcon, SunIcon } from "lucide-react"
import { useSyncExternalStore } from "react"

export default function ThemeToggle() {
  const dark = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  )

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={dark ? "切换到浅色" : "切换到深色"}
      onClick={() => themeStore.toggleDark()}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}
