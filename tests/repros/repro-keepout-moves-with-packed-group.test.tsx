import { expect, test } from "bun:test"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("keepout inside a packed group moves with the group", async () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <board
      width="30mm"
      height="20mm"
      pcbPack
      pcbPackGap="2mm"
      routingDisabled
      schematicDisabled
    >
      {["GA", "GB", "GC"].map((groupName, i) => (
        <group key={groupName} name={groupName}>
          <resistor name={`R${i + 1}`} resistance="1k" footprint="1206" />
          <keepout
            shape="rect"
            width="6mm"
            height="3mm"
            layers={["top", "bottom"]}
            allowPlacements
            allowTraces
          />
        </group>
      ))}
      <trace from=".R1 > .pin2" to=".R2 > .pin1" />
      <trace from=".R2 > .pin2" to=".R3 > .pin1" />
    </board>,
  )
  await circuit.renderUntilSettled()

  const keepouts = circuit.db.pcb_keepout.list()
  expect(keepouts).toHaveLength(3)

  // Each keepout is declared at its group's origin, like its resistor, so
  // after packing it must still sit at the resistor's center
  for (const [i, groupName] of ["GA", "GB", "GC"].entries()) {
    const sourceGroup = circuit.db.source_group.getWhere({ name: groupName })!
    const pcbGroup = circuit.db.pcb_group.getWhere({
      source_group_id: sourceGroup.source_group_id,
    })!
    const sourceResistor = circuit.db.source_component.getWhere({
      name: `R${i + 1}`,
    })!
    const resistor = circuit.db.pcb_component.getWhere({
      source_component_id: sourceResistor.source_component_id,
    })!
    const keepout = circuit.db.pcb_keepout.getWhere({
      pcb_group_id: pcbGroup.pcb_group_id,
    })
    if (keepout?.shape !== "rect") {
      throw new Error(`Expected a rectangular keepout in ${groupName}`)
    }

    expect(keepout.center.x).toBeCloseTo(resistor.center.x, 3)
    expect(keepout.center.y).toBeCloseTo(resistor.center.y, 3)
  }

  // The pack layout really spread the groups out
  const keepoutCenters = new Set(
    keepouts.map((k) => {
      if (k.shape !== "rect") throw new Error("Expected rectangular keepouts")
      return `${k.center.x.toFixed(3)},${k.center.y.toFixed(3)}`
    }),
  )
  expect(keepoutCenters.size).toBe(3)
})
