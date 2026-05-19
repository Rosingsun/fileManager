import React from 'react'
import { CheckOutlined } from '@ant-design/icons'
import classNames from 'classnames'
import { WORKFLOW_STEPS, type QuickFilterWorkflowStep } from './quickFilterShared'

interface QuickFilterWorkflowStepsProps {
  current: QuickFilterWorkflowStep
}

const stepOrder: QuickFilterWorkflowStep[] = ['config', 'scan', 'review']

const QuickFilterWorkflowSteps: React.FC<QuickFilterWorkflowStepsProps> = ({ current }) => {
  const currentIndex = stepOrder.indexOf(current)

  return (
    <nav className="qf-steps" aria-label="快速筛选流程">
      <div className="qf-steps__track">
        {WORKFLOW_STEPS.map((step, index) => {
          const isDone = index < currentIndex
          const isCurrent = step.key === current

          return (
            <div
              key={step.key}
              className={classNames('qf-steps__seg', {
                'is-done': isDone,
                'is-current': isCurrent,
              })}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className="qf-steps__index" aria-hidden>
                {isDone ? <CheckOutlined /> : index + 1}
              </span>
              <span className="qf-steps__text">
                <span className="qf-steps__short">{step.short}</span>
                <span className="qf-steps__label">{step.label}</span>
              </span>
            </div>
          )
        })}
      </div>
    </nav>
  )
}

export default QuickFilterWorkflowSteps
