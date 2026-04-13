import { NavLink } from 'react-router-dom'
import { motion } from 'motion/react'
import type { NavItem } from '../../../app/navigation/routes'
import { cn } from '../../utils/cn'

type NubaPillNavProps = {
  items: NavItem[]
}

export function NubaPillNav({ items }: NubaPillNavProps) {
  return (
    <nav
      className="relative grid gap-1.5 rounded-[28px] border border-[#2A3545]/70 bg-[linear-gradient(180deg,_rgb(29_38_52_/_0.94),_rgb(18_24_33_/_0.96))] p-[0.32rem] shadow-[0_28px_64px_-36px_rgb(4_8_14_/_0.92),0_-1px_0_rgb(255_255_255_/_0.03)] backdrop-blur-[30px]"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              'relative flex min-h-[3.18rem] flex-col items-center justify-center gap-1 rounded-[19px] px-1.5 py-1 text-[10px] font-medium tracking-[0.01em] transition duration-200 sm:min-h-[3.35rem] sm:px-2 sm:text-[11px]',
              isActive ? 'text-nuba-text' : 'text-nuba-text-muted/78',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive ? (
                <motion.span
                  layoutId="nuba-mobile-pill"
                  className="absolute inset-0 rounded-[19px] border border-white/8 bg-white/[0.075] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08),0_12px_24px_-20px_rgb(0_0_0_/_0.95)]"
                  transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                />
              ) : null}
              <span
                className={cn(
                  'relative z-10 flex flex-col items-center gap-1.5 pt-1',
                  isActive && 'text-nuba-text [text-shadow:0_0_10px_rgb(124_158_255_/_0.18)]',
                )}
              >
                <item.icon
                  className={cn(
                    'h-[1.08rem] w-[1.08rem] sm:h-[1.5rem] sm:w-[1.5rem]',
                    isActive ? 'opacity-100 drop-shadow-[0_0_10px_rgb(124_158_255_/_0.22)]' : 'opacity-78',
                  )}
                />
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
