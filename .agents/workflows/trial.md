## Trial Workflow: 2-Minute Improvement Loop
1. **Architect**: Analyze the current project and identify one specific logic improvement.
2. **Refactorer**: Implement the Architect's suggestion.
3. **Tester**: Run the code (using `npm test` or `pytest`) and provide a "Pass/Fail" report.
4. **Loop**: If the Tester finds an issue, send it back to the **Refactorer**. 
5. **Exit**: Stop after 2 cycles or if all tests pass.
