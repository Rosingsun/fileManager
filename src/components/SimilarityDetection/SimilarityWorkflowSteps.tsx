import React from 'react'
import { CheckOutlined } from '@ant-design/icons'
import classNames from 'classnames'
import { WORKFLOW_STEPS, type SimilarityWorkflowStep } from './similarityShared'

interface SimilarityWorkflowStepsProps {
  current: SimilarityWorkflowStep
}

const stepOrder: SimilarityWorkflowStep[] = ['config', 'scan', 'review']

const SimilarityWorkflowSteps: React.FC<SimilarityWorkflowStepsProps> = ({ current }) => {
  const currentIndex = stepOrder.indexOf(current)

  return (
    <nav className="sim-steps" aria-label="相似照片检测流程">
      <div className="sim-steps__track">
        {WORKFLOW_STEPS.map((step, index) => {
          const isDone = index < currentIndex
          const isCurrent = step.key === current

          return (
            <div
              key={step.key}
              className={classNames('sim-steps__seg', {
                'is-done': isDone,
                'is-current': isCurrent,
              })}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className="sim-steps__index" aria-hidden>
                {isDone ? <CheckOutlined /> : index + 1}
              </span>
              <span className="sim-steps__text">
                <span className="sim-steps__short">{step.short}</span>
                <span className="sim-steps__label">{step.label}</span>
              </span>
            </div>
          )
        })}
      </div>
    </nav>
  )
}

export default SimilarityWorkflowSteps
