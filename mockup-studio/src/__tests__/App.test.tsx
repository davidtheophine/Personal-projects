import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { App } from "../App"

test("renders the editor shell with an import prompt", () => {
  render(<App />)
  expect(screen.getByText("Mockup Studio")).toBeInTheDocument()
  expect(screen.getByText("Drop a screen recording")).toBeInTheDocument()
})
