import { readData, writeData, getMonday, parseArgs } from './lib/data'

const args = parseArgs(process.argv)
const weekStr = args['week']
const projectsStr = args['projects']

if (!weekStr) {
  process.stderr.write('Error: --week YYYY-MM-DD is required\n')
  process.exit(1)
}

if (!projectsStr) {
  process.stderr.write('Error: --projects ID1,ID2[,ID3] is required\n')
  process.exit(1)
}

const weekStart = getMonday(weekStr)
const projectIds = projectsStr.split(',').map((s) => s.trim()).filter(Boolean)

if (projectIds.length > 3) {
  process.stderr.write(
    `Error: Maximum 3 focus projects allowed, got ${projectIds.length}\n`
  )
  process.exit(1)
}

if (projectIds.length === 0) {
  process.stderr.write('Error: At least one project ID is required\n')
  process.exit(1)
}

const data = readData()

// Validate that all project IDs exist
const unknownIds = projectIds.filter(
  (id) => !data.projects.some((p) => p.id === id)
)
if (unknownIds.length > 0) {
  process.stderr.write(
    `Error: Unknown project IDs: ${unknownIds.join(', ')}\n`
  )
  process.exit(1)
}

// Find or create week plan
let weekPlan = data.weekPlans.find((w) => w.weekStart === weekStart)
if (!weekPlan) {
  weekPlan = {
    weekStart,
    focusProjects: [],
    dailyAllocations: [],
  }
  data.weekPlans.push(weekPlan)
}

weekPlan.focusProjects = projectIds
writeData(data)

const output = {
  weekStart,
  focusProjects: projectIds,
}
process.stdout.write(JSON.stringify(output, null, 2) + '\n')
process.exit(0)
