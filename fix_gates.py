#!/usr/bin/env python3
"""Add wave_execution config key to config.cjs only"""

with open('get-shit-done/bin/lib/config.cjs', 'r') as f:
    c = f.read()

# Add workflow.wave_execution to VALID_CONFIG_KEYS
c = c.replace(
    "'workflow.use_worktrees',\n  'git.branching_strategy',",
    "'workflow.use_worktrees',\n  'workflow.wave_execution',\n  'git.branching_strategy',"
)

with open('get-shit-done/bin/lib/config.cjs', 'w') as f:
    f.write(c)
print("config.cjs: added workflow.wave_execution")
