import { motion } from "framer-motion";
import { ScrollText, ShieldCheck, Users2, Landmark } from "lucide-react";

export default function Charter() {
  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-12"
      >
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-display font-bold tracking-tight">The Free Soul Charter</h1>
          <p className="text-xl text-muted-foreground font-medium">Ecclesiastical Movement PMA</p>
          <div className="h-1 w-24 bg-primary mx-auto rounded-full" />
        </div>

        <section className="glass-panel p-8 rounded-3xl space-y-8 leading-relaxed text-lg">
          <div className="flex items-start gap-4">
            <ScrollText className="w-8 h-8 text-primary mt-1 flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-display font-bold mb-4">Our Mission</h2>
              <p className="text-muted-foreground">
                To foster a sanctuary for creative expression and spiritual sovereignty, 
                where artists and seekers unite under the banner of divine inspiration 
                and collective stewardship.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-bold">PMA Status</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Operating as a Private Membership Association, we protect the 
                rights of our members to collaborate and share without external interference.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Users2 className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-bold">Collective Unity</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Every voice matters. We distribute credits and recognition 
                fairly based on creative and energetic contributions.
              </p>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5">
            <div className="flex items-center gap-3 mb-4">
              <Landmark className="w-6 h-6 text-primary" />
              <h3 className="text-xl font-bold">The Covenant</h3>
            </div>
            <p className="text-muted-foreground italic">
              "We, the creators and dreamers of Free Soul, acknowledge our role 
              as vessels for the infinite. We pledge to honor the stem, the file, 
              and the idea as sacred contributions to the shared work of the movement."
            </p>
          </div>
        </section>

        <div className="text-center pt-8">
          <p className="text-sm text-muted-foreground">
            © 2026 Free Soul the Movement. All rights reserved under ecclesiastical law.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
