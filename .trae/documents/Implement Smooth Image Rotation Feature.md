1. **Modify Rotation State Tracking**: Change the rotation state to track cumulative values (can go beyond 0-360 degrees) instead of wrapping with modulo 360
2. **Update Rotation Functions**: 
   - `handleRotateLeft`: Subtract 90 degrees without wrapping
   - `handleRotateRight`: Add 90 degrees without wrapping  
   - `handleResetRotation`: Set to 0 degrees
3. **Maintain CSS Transform Compatibility**: The CSS rotate property accepts any degree value, so we can use the cumulative rotation directly
4. **Ensure Single 90-Degree Increments**: Each rotation click will only change the rotation by exactly 90 degrees in the requested direction
5. **Test the Fix**: Verify that rotations are smooth and don't cause visual jumps, especially when rotating through 0/360 degrees

This implementation will maintain cumulative rotation state, prevent跨越式 angle rotations, and ensure smooth animations while adhering to the 90-degree increment requirement.