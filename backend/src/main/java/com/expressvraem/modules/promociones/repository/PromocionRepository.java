package com.expressvraem.modules.promociones.repository;

import com.expressvraem.modules.promociones.entity.Promocion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PromocionRepository extends JpaRepository<Promocion, Long> {

    List<Promocion> findAllByOrderByActivaDescNombreAsc();

    List<Promocion> findByActivaTrueOrderByNombreAsc();

    Optional<Promocion> findByCodigoIgnoreCase(String codigo);
}
