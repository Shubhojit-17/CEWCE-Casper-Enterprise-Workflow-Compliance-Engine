/**
 * Narrative Lab - Workflow Diagram SVG
 * Mock node graph that responds to scroll state
 * 
 * ALIGNED WITH CEWCE WORKFLOW LIFECYCLE:
 * DRAFT → CONFIRM → DOCUMENTS → REVIEW → APPROVED → ANCHOR
 * 
 * Important: Only ANCHOR touches the blockchain.
 * All prior states are off-chain.
 */
import { motion } from 'framer-motion';

// Correct workflow states matching CEWCE lifecycle
export type WorkflowState = 'DRAFT' | 'CONFIRM' | 'DOCUMENTS' | 'REVIEW' | 'APPROVED' | 'ANCHOR';

interface WorkflowDiagramProps {
  activeState: WorkflowState;
}

// Node positions for the workflow diagram (6 stages)
const nodePositions = [
  { id: 'draft', cx: 40, cy: 70, label: 'Draft' },
  { id: 'confirm', cx: 120, cy: 70, label: 'Confirm' },
  { id: 'documents', cx: 200, cy: 70, label: 'Documents' },
  { id: 'review', cx: 280, cy: 70, label: 'Review' },
  { id: 'approved', cx: 370, cy: 70, label: 'Approved' },
  { id: 'anchor', cx: 450, cy: 70, label: 'Anchor' },
];

const connections = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
  { from: 4, to: 5 },
];

const stateToNodeIndex: Record<WorkflowState, number> = {
  DRAFT: 0,
  CONFIRM: 1,
  DOCUMENTS: 2,
  REVIEW: 3,
  APPROVED: 4,
  ANCHOR: 5,
};

export function WorkflowDiagram({ activeState }: WorkflowDiagramProps) {
  const activeIndex = stateToNodeIndex[activeState];
  const isOnChain = activeState === 'ANCHOR';
  const isReviewPhase = activeState === 'REVIEW';

  return (
    <svg viewBox="0 0 500 130" className="w-full h-auto">
      {/* On-chain zone background (APPROVED + ANCHOR area) */}
      <rect
        x="340"
        y="25"
        width="150"
        height="90"
        rx="8"
        fill={isOnChain ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.02)'}
        stroke={isOnChain ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255,255,255,0.05)'}
        strokeWidth="1"
        strokeDasharray={isOnChain ? '0' : '4 2'}
      />
      <text
        x="415"
        y="110"
        textAnchor="middle"
        className="text-[7px] font-mono uppercase"
        fill={isOnChain ? 'rgba(34, 197, 94, 0.8)' : 'rgba(255,255,255,0.2)'}
      >
        {isOnChain ? '● On-Chain' : 'Blockchain Zone'}
      </text>

      {/* Off-chain label */}
      <text
        x="160"
        y="110"
        textAnchor="middle"
        className="text-[7px] font-mono uppercase"
        fill="rgba(255,255,255,0.25)"
      >
        Off-Chain
      </text>

      {/* Rejection loop (visible during REVIEW) */}
      {isReviewPhase && (
        <>
          <motion.path
            d={`M ${nodePositions[3].cx} ${nodePositions[3].cy + 18} 
                Q ${(nodePositions[2].cx + nodePositions[3].cx) / 2} ${nodePositions[3].cy + 40}
                ${nodePositions[2].cx} ${nodePositions[2].cy + 18}`}
            fill="none"
            stroke="rgba(239, 68, 68, 0.4)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
          />
          <text
            x={(nodePositions[2].cx + nodePositions[3].cx) / 2}
            y={nodePositions[3].cy + 52}
            textAnchor="middle"
            className="text-[6px]"
            fill="rgba(239, 68, 68, 0.6)"
          >
            rejection → revision
          </text>
        </>
      )}
      {/* Connection lines */}
      {connections.map((conn, idx) => {
        const from = nodePositions[conn.from];
        const to = nodePositions[conn.to];
        const isActive = conn.from < activeIndex;
        const isCurrentTransition = conn.from === activeIndex - 1;
        
        // Special styling for APPROVED → ANCHOR (the blockchain write)
        const isBlockchainTransition = conn.from === 4 && conn.to === 5;

        return (
          <g key={idx}>
            {/* Background line */}
            <line
              x1={from.cx}
              y1={from.cy}
              x2={to.cx}
              y2={to.cy}
              stroke={isBlockchainTransition ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.1)'}
              strokeWidth="2"
              strokeDasharray={isBlockchainTransition ? '4 2' : '0'}
            />
            {/* Active line */}
            <motion.line
              x1={from.cx}
              y1={from.cy}
              x2={to.cx}
              y2={to.cy}
              stroke={
                isBlockchainTransition && isActive ? '#22c55e' :
                isActive ? '#3b82f6' : 
                'transparent'
              }
              strokeWidth="2"
              initial={{ pathLength: 0 }}
              animate={{ 
                pathLength: isActive ? 1 : 0,
                opacity: isCurrentTransition ? [0.7, 1, 0.7] : 1
              }}
              transition={{ 
                duration: 0.5,
                opacity: isCurrentTransition ? { duration: 1.5, repeat: Infinity } : undefined
              }}
            />
          </g>
        );
      })}

      {/* Nodes */}
      {nodePositions.map((node, idx) => {
        const isActive = idx === activeIndex;
        const isComplete = idx < activeIndex;
        const isFuture = idx > activeIndex;
        const isAnchorNode = idx === 5;

        // Color logic: blue for off-chain progress, green for on-chain
        let fillColor = 'rgba(255,255,255,0.05)';
        let strokeColor = 'rgba(255,255,255,0.2)';
        
        if (isComplete) {
          fillColor = isAnchorNode ? '#22c55e' : '#3b82f6';
          strokeColor = isAnchorNode ? '#22c55e' : '#3b82f6';
        } else if (isActive) {
          fillColor = isAnchorNode ? '#22c55e' : '#ef4444';
          strokeColor = isAnchorNode ? '#22c55e' : '#ef4444';
        }

        return (
          <g key={node.id}>
            {/* Glow effect for active node */}
            {isActive && (
              <motion.circle
                cx={node.cx}
                cy={node.cy}
                r="20"
                fill="none"
                stroke={isAnchorNode ? '#22c55e' : '#ef4444'}
                strokeWidth="2"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ 
                  opacity: [0.2, 0.5, 0.2], 
                  scale: [1, 1.15, 1] 
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            
            {/* Node circle */}
            <motion.circle
              cx={node.cx}
              cy={node.cy}
              r="13"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="2"
              animate={{
                scale: isActive ? [1, 1.05, 1] : 1,
              }}
              transition={{ duration: 1.5, repeat: isActive ? Infinity : 0 }}
            />

            {/* Checkmark for complete nodes */}
            {isComplete && (
              <motion.path
                d={`M${node.cx - 4} ${node.cy} L${node.cx - 1} ${node.cy + 3} L${node.cx + 4} ${node.cy - 3}`}
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3 }}
              />
            )}

            {/* Blockchain icon for ANCHOR node when not complete */}
            {isAnchorNode && !isComplete && !isActive && (
              <rect
                x={node.cx - 3}
                y={node.cy - 3}
                width="6"
                height="6"
                rx="1"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1"
              />
            )}

            {/* Node label */}
            <text
              x={node.cx}
              y={node.cy - 20}
              textAnchor="middle"
              className="text-[8px] font-medium"
              fill={isFuture ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)'}
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
