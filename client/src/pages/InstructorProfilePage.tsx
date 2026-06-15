import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSupabase } from "@/contexts/SupabaseContext";
import { getRouteInfo } from "@/services/naverRouteService";
import type { InstructorProfile } from "@/types/instructor";
import { Car, Mail, MapPin, Phone, Save, ShieldCheck, User } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const defaultProfile: InstructorProfile = {
  name: "",
  homeAddress: "",
  phone: "",
  email: "",
  customFields: [],
};

export default function InstructorProfilePage() {
  const { profile: dbProfile, updateProfile, lectures, updateLecture } = useSupabase();
  const [profile, setProfile] = useState<InstructorProfile>(defaultProfile);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (dbProfile) setProfile({ ...defaultProfile, ...dbProfile });
  }, [dbProfile]);

  const handleFieldChange = (field: keyof InstructorProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateProfile(profile);
      toast.success("프로필을 저장했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "프로필 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearchNaverMap = () => {
    const address = profile.homeAddress.trim();
    if (!address) {
      toast.error("검색할 주소를 입력해주세요.");
      return;
    }
    window.open(`https://map.naver.com/v5/search/${encodeURIComponent(address)}`, "_blank", "noopener,noreferrer");
  };

  const handleRecalculateAllRoutes = async () => {
    const homeAddress = profile.homeAddress.trim();
    if (!homeAddress) {
      toast.error("출발지 주소를 먼저 저장해주세요.");
      return;
    }

    const lecturesWithLocation = lectures.filter((lecture) => lecture.location?.trim());
    if (lecturesWithLocation.length === 0) {
      toast.info("장소가 등록된 강의가 없습니다.");
      return;
    }

    setIsRecalculating(true);
    setProgress({ current: 0, total: lecturesWithLocation.length });

    let successCount = 0;
    let failCount = 0;

    for (let index = 0; index < lecturesWithLocation.length; index += 1) {
      const lecture = lecturesWithLocation[index];
      setProgress({ current: index + 1, total: lecturesWithLocation.length });

      try {
        const route = await getRouteInfo(homeAddress, lecture.location);
        await updateLecture(lecture.id, {
          travelDistanceKm: route.distanceKm,
          travelDurationMin: route.durationMin,
          travelUpdatedAt: new Date().toISOString(),
        });
        successCount += 1;
      } catch (error) {
        console.error(`Failed to calculate route for lecture ${lecture.id}:`, error);
        failCount += 1;
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    setIsRecalculating(false);
    toast.success(`경로 계산 완료: 성공 ${successCount}건, 실패 ${failCount}건`);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">강사 프로필</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          연락처와 출발 주소를 관리합니다. 네이버 API secret은 이 화면에 저장하지 않습니다.
        </p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              기본 정보
            </CardTitle>
            <CardDescription>강의 관리와 문자 템플릿에 사용할 정보를 입력합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field icon={User} id="profile-name" label="이름">
              <Input
                id="profile-name"
                value={profile.name}
                onChange={(event) => handleFieldChange("name", event.target.value)}
              />
            </Field>
            <Field icon={Phone} id="profile-phone" label="전화번호">
              <Input
                id="profile-phone"
                value={profile.phone}
                onChange={(event) => handleFieldChange("phone", event.target.value)}
              />
            </Field>
            <Field icon={Mail} id="profile-email" label="이메일">
              <Input
                id="profile-email"
                type="email"
                value={profile.email}
                onChange={(event) => handleFieldChange("email", event.target.value)}
              />
            </Field>
            <Field icon={MapPin} id="profile-address" label="출발 주소">
              <div className="flex gap-2">
                <Input
                  id="profile-address"
                  value={profile.homeAddress}
                  onChange={(event) => handleFieldChange("homeAddress", event.target.value)}
                />
                <Button type="button" variant="outline" onClick={handleSearchNaverMap}>
                  지도 검색
                </Button>
              </div>
            </Field>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              <Save className="mr-1.5 h-4 w-4" />
              {isSaving ? "저장 중" : "저장"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Car className="h-5 w-5 text-primary" />
              경로 캐시
            </CardTitle>
            <CardDescription>
              모든 강의의 거리/시간을 수동으로 다시 계산해 Supabase 캐시값을 갱신합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" onClick={handleRecalculateAllRoutes} disabled={isRecalculating}>
              {isRecalculating ? `계산 중 (${progress.current}/${progress.total})` : "전체 경로 다시 계산"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              네이버 API 보안 설정
            </CardTitle>
            <CardDescription>
              Vercel 프로젝트 환경변수에 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`을 설정하세요. Client Secret은
              브라우저, Supabase 공개 테이블, `NEXT_PUBLIC_*` 변수에 저장하지 않습니다.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  id,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Label>
      {children}
    </div>
  );
}
